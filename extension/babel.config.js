module.exports = function (api) {
    api.cache(true);

    const plugins = [];

    if (process.env.UI_DEBUG_MODE === 'true') {
        plugins.push(['react-component-data-attribute', {
            onlyRootComponents: false, // Add to all components
        }]);
    }

    return {
        presets: [],
        plugins: plugins,
    };
};
