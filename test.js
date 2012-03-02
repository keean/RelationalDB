var http = require('http');
var relational = require('./relational.js');

var rdm = new relational.RelationalDataModel;
var rdb = new rdm.PostgreSQLDataAdapter;

var account_managers = rdm.relation('account_managers', {
    id: rdm.attribute('id', rdm.integer /*, {auto_increment: true}*/),
    name: rdm.attribute('name', rdm.string, {unique: true}),
});

var v = rdb.validate('pg://pm:test123@localhost/pm', 1.0, [account_managers], true);
v.onerror = console.log;
v.onsuccess = function(db) {
    var t = db.transaction(function(tx) {
        [
            {id: 1, name: 'Anna'},
            {id: 2, name: 'Betty'},
            {id: 3, name: 'Christine'},
            {id: 3, name: 'Christine'}
        ].forEach(function(k) {
            tx.insert(account_managers, k).onsuccess = function(results) {
                console.log('Saved record for ' + k.name + ' with id ' + results.id);
                tx.insert(account_managers, {id: 4});
            };
        })
    });
    t.onerror = function(error) {
        console.log('test ' + JSON.stringify(error));
    };
    t.onsuccess = function() {
        console.log('[done]');
    };
};

/*
v.onerror = console.log;
v.onsuccess = function(db) {
    var server = http.createServer(function(request, response) {
        var data = '';
        request.on('data', function(chunk) {
            data += chunk;
        });

        response.writeHead(501, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({message: 'not implemented'}));
    });
    
    server.listen(8080);
};
*/
