export class HttpError extends Error {
    /**
     * @param status HTTP status code
     * @param statusText HTTP status text
     * @param response The original Response. Its body has already been consumed;
     *   use `bodyText` for the content.
     * @param bodyText Response body as text (may be empty).
     */
    constructor(
        public status: number,
        public statusText: string,
        public response: Response,
        public bodyText: string = '',
    ) {
        super(`HTTP Error: ${status} ${statusText}`);
        this.name = 'HttpError';
    }
}
