export function format(msgs) {
    const results = {};
    // Iterate through all extracted messages
    for (const [id, msg] of Object.entries(msgs)) {
        results[id] = {
            message: msg.defaultMessage,
            // Fallback description ensures the schema is always valid, 
            // though linting should enforce explicit descriptions.
            description: msg.description || "No description provided"
        };
    }
    // Sort keys alphabetically. This is crucial for Git.
    // It ensures that adding a key doesn't result in random diff noise,
    // making code reviews of the generated JSON easier.
    return Object.keys(results).sort().reduce((acc, key) => {
        acc[key] = results[key];
        return acc;
    }, {});
};
