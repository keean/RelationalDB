var http = require('http');
var relational = require('./relational.js');

var rdm = new relational.RelationalDataModel;
var rdb = new rdm.PostgreSQLDataAdapter;

var account_managers = rdm.relation('account_managers', {
    id: rdm.attribute('id', rdm.integer /*, {auto_increment: true}*/),
    name: rdm.attribute('name', rdm.string, {unique: true}),
});

rdb.validate(
    'pg://pm:test123@localhost/pm',
    1.0,
    [account_managers],
    true
).on('error', function(error) {
    console.log('[validate ' + error + ']');
}).on('ready', function(db) {
    db.transaction(function(tx) {
        [
            {id: 1, name: 'Anna'},
            {id: 2, name: 'Betty'},
            {id: 3, name: 'Christine'},
            //{id: 3, name: 'Christine'}
        ].forEach(function(k) {
            tx.insert(account_managers, k).on('row', function(r) {
                console.log('Saved record for ' + r.name + ' with id ' + r.id);
            }).on('end', function() {
                tx.insert(account_managers, {id: 4});
            });
        })
    }).on('error', function(error) {
        console.log('[transaction ' + error + ']');
    }).on('end', function() {
        console.log('[transaction done]');
        db.transaction(function(tx) {
            tx.query(account_managers).on('row', function(r) {
                console.log('row: id=' + r.id + ' name=' + r.name);
            });
        });   
    });
});

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
