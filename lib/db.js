var mysql = require('mysql');

exports.create = function DB(){
	var client = mysql.createClient({
		user: 'root',
		password: 'root'
	});
	client.host = '127.0.0.1';
	client.port=3306;
	client.database = 'invest'
	return client;
}
/*
var c = new connectServer;
c.query('select * from skipfish;',function(err, results, fields){
	if(err){
		console.info(err);
	}
	console.info(results);
	console.info(fields);
});
*/
