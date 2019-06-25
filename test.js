/**
 * Created by junming on 2019/6/25.
 */
const newman = require('newman'); // require newman in your project

newman.run({
    collection: require('./Argus_test.postman_collection.json'), // can also provide a URL or path to a local JSON file.
    reporters: 'html',
    reporter: {
        html: {
            export: './htmlResults.html', // If not specified, the file will be written to `newman/` in the current working directory.
        }
    }
}, function (err) {
    if (err) { throw err; }
    console.log('collection run complete!');
});