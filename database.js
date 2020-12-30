var sqlite3 = require('sqlite3').verbose()
var shajs = require('sha.js')

const DBSOURCE = "snell.db"

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message)
      throw err
    } else {
        db.run(`CREATE TABLE user (
            email TEXT, 
            name TEXT, 
            password TEXT, 
            PRIMARY KEY (email)
            )`,
        (err) => {
            if (!err) {
                var passwd = shajs('sha256').update('snell').digest('hex');
                db.run('INSERT INTO user (email, name, password) VALUES (?,?,?)', ["snell@lindeman.nu", "mark", passwd])
                db.run('CREATE INDEX idx_password ON user (password)')
            }
        });

        db.run(`CREATE TABLE countries (user INTEGER, id CHAR(2), PRIMARY KEY (user, id))`, (err) => {
        })

        db.run(`CREATE TABLE regions (user INTEGER, country CHAR(2), id CHAR(5), PRIMARY KEY (user, country, id))`, (err) => {
        })
    }
});


module.exports = db