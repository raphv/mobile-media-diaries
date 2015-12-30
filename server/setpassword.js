var config = require('../config.js');
var monk = require('monk');
var prompt = require('prompt');
var process = require('process');
var passhash = require('password-hash');
var config_collection = monk(config.db_connection).get(config.db_collection + '_config');

prompt.start();

prompt.get([{
    description: 'Enter the admin username',
    name: 'username',
    required: true
}, {
    description: 'Enter the admin password',
    name: 'password',
    required: true,
    hidden: true,
    pattern: /^\S{8,}$/,
    message: 'Must be 8 characters or longer'
}], function(err, result) {
    if (err) {
        console.log('\nPassword could not be set');
        process.exit();
    }
    var hashedPass = 
    config_collection.remove({
        key: 'admin_credentials'
    }, function(err) {
        if (err) {
            console.log('\nDatabase couldn\'t be updated');
            process.exit();
        }
        config_collection.insert({
            key: 'admin_credentials',
            username: result.username,
            password: passhash.generate(result.password)
        }, function(err) {
            if (err) {
                console.log('\nDatabase couldn\'t be updated');
            } else {
                console.log('\nPassword saved');
            }
            process.exit();
        });
    });
});

