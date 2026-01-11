/** Represents any valid XML-RPC value */
export type XmlRpcValue = string | number | boolean | XmlRpcValue[] | { [key: string]: XmlRpcValue } | null;

export class XmlRpcHelper {
    static createCall(method: string, params: XmlRpcValue[]): string {
        let xml = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>`;
        for (const param of params) {
            xml += `<param>${this.serialize(param)}</param>`;
        }
        xml += `</params></methodCall>`;
        return xml;
    }

    static parseResponse(xml: string): XmlRpcValue {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        const fault = doc.querySelector('fault');
        if (fault) {
            const value = fault.querySelector('value');
            const parsedFault = this.deserialize(value);
            if (parsedFault && typeof parsedFault === 'object' && !Array.isArray(parsedFault)) {
                const faultObj = parsedFault as { faultString?: XmlRpcValue; faultCode?: XmlRpcValue };
                throw new Error(`XML-RPC Fault: ${faultObj.faultString} (${faultObj.faultCode})`);
            }
            throw new Error('XML-RPC Fault: Unknown error');
        }

        const params = doc.querySelectorAll('methodResponse > params > param > value');
        if (params.length === 0) return null;

        // Usually one return value
        return this.deserialize(params[0]);
    }

    private static serialize(value: XmlRpcValue): string {
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return `<value><i4>${value}</i4></value>`;
            return `<value><double>${value}</double></value>`;
        }
        if (typeof value === 'string') {
            return `<value><string>${this.escape(value)}</string></value>`;
        }
        if (typeof value === 'boolean') {
            return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
        }
        if (Array.isArray(value)) {
            let xml = `<value><array><data>`;
            for (const item of value) {
                xml += this.serialize(item);
            }
            xml += `</data></array></value>`;
            return xml;
        }
        // Struct not implemented yet as ruTorrent mostly uses arrays/primitives for calls
        return `<value><string>${this.escape(String(value))}</string></value>`;
    }

    private static escape(str: string): string {
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private static deserialize(node: Element | null): XmlRpcValue {
        if (!node) return null;

        // node is <value>
        const child = node.firstElementChild;
        if (!child) {
            // Empty value or just text?
            return node.textContent;
        }

        switch (child.tagName) {
            case 'string': return child.textContent ?? '';  // Empty string elements return '' not null
            case 'i4':
            case 'int': return parseInt(child.textContent || '0', 10);
            case 'double': return parseFloat(child.textContent || '0');
            case 'boolean': return child.textContent === '1';
            case 'array': {
                const data = child.querySelector('data');
                if (!data) return [];
                const values = Array.from(data.children); // <value> elements
                return values.map(v => this.deserialize(v as Element));
            }
            case 'struct': {
                const members = Array.from(child.children); // <member> elements
                const obj: Record<string, XmlRpcValue> = {};
                for (const member of members) {
                    const name = member.querySelector('name')?.textContent || '';
                    const value = member.querySelector('value');
                    obj[name] = this.deserialize(value);
                }
                return obj;
            }
            default: return child.textContent;
        }
    }
}
