/**
 * Base class for all torrent-client adapter errors.
 *
 * Each adapter defines its own subclass with a domain-specific `type` union and a
 * `toUserMessage()` implementation that maps those types to human-readable strings.
 * This base class holds no adapter-specific content: it carries only the `type`
 * discriminant and the underlying error message, and declares the contract that
 * every subclass must satisfy.
 *
 * The class is generic over the discriminant union so subclasses can narrow `type`
 * (e.g. `AdapterError<BiglyBTErrorType>`) while the base still constrains it to a
 * string discriminant. It defaults to `string` so the plain form reads as
 * "type is a string discriminant".
 */
export abstract class AdapterError<TType extends string = string> extends Error {
    /** Discriminant identifying the error category. */
    public readonly type: TType;

    constructor(type: TType, message: string) {
        super(message);
        // new.target resolves to the concrete subclass being constructed.
        this.name = new.target.name;
        this.type = type;

        // Restore the prototype chain so `instanceof` works after transpilation
        // to ES5/ES2015 targets where extending built-ins otherwise breaks it.
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Returns a human-readable, user-facing message for this error.
     * Implemented per-adapter against that adapter's error-type union.
     */
    abstract toUserMessage(): string;
}
