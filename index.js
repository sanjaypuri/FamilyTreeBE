const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const conn = require('./database/mysql');
const fetchuser = require('./fetchuser');

require('dotenv').config()

const app = express();

app.use(bodyparser.json());
app.use(express.json());

app.use(cors(
  {
    origin: ["http://localhost:3000", "https://urlofthefrontendappafterdeployment.com"],
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    credentials: true
  }
));

////////////////
//Add new User//
///////////////
app.post("/api/newuser", (req, res) => {
  const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
  const { username, password } = req.body;
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return res.json({ success: false, error: err });
    };
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      try {
        conn.query(sql, [username, hash], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({ success: true, data: "", message: `${username} registered successfully` });
          } else {
            return res.json({ success: false, error: `${username} could not be registered` });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  });
});

//////////////
//User Login//
/////////////
app.post("/api/login", (req, res) => {
  const sql = "SELECT * FROM users where username = ?";
  const { username, password } = req.body;
  try {
    conn.query(sql, [username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      if (result.length === 0) {
        return res.json({ success: false, error: "Invalid username or password" });
      };
      bcrypt.compare(password, result[0].password, (err, validUser) => {
        if (err) {
          return res.json({ success: false, error: err });
        };
        if (validUser) {
          const username = result[0].username;
          const token = jwt.sign({ loggedinUser: username }, process.env.SECRET_KEY);
          return res.json({
            success: true,
            data: {
              userid: result[0].id,
              user: result[0].username,
              token: token
            },
            message: `${username} logged in successfully`
          });
        } else {
          return res.json({ success: false, error: "Invalid username or password" });
        };
      });
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

///////////////////
//List of persons//
///////////////////
app.get("/api/list", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users where username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      const userid = result[0].id;
      sql = "SELECT id value, name label FROM person WHERE userid = ? order by name";
      try{
        conn.query(sql, [userid], (err, result) => {
          if(err) {
            return res.json ({success:false, error:err});
          };
          return res.json({success:true, data:result});
        });
      } catch(err) {
        return res.json({ success: false, error: err });
      };
    });
    } catch(err) {
    return res.json({ success: false, error: err });
  };
});

//////////////////
//Add New Person//
//////////////////
app.post("/api/newperson", fetchuser, async (req, res) => {
  const { name, dob, dod } = req.body;
  let sql = "SELECT * FROM users where username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      const userid = result[0].id;
      sql = "INSERT INTO person (name, dob, dod, userid) VALUES (?, ?, ?, ?)";
      try {
        conn.query(sql, [name, dob, dod, userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.affectedRows) {
            return res.json({ success: true, message: "Reords saved" });
          } else {
            return res.json({ success: false, error: "Database Error" });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

///////////////////
//List of Persons//
///////////////////
app.get("/api/listpersons", fetchuser, async (req, res) => {
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      const userid = result[0].id;
      sql = "SELECT id, name, dob, dom, dod FROM person WHERE userid = 1  ORDER BY name";
      try {
        conn.query(sql, (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          if (result.length) {
            return res.json({ success: true, data: result });
          } else {
            return res.json({ success: false, error: "No records available" });
          };
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
  };
});

//////////////////////////////
//Find relations of a person//
//////////////////////////////
app.get("/api/relations/:id", fetchuser, async (req, res) => {
  const id = req.params.id;
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      const userid = result[0].id;
      sql = "SELECT r.id, p.id as personid, p.name, t.relation, pp.name AS relative FROM relation r LEFT JOIN relation_type t ON t.id = r.relationid LEFT JOIN person p ON p.id = r.relationof LEFT JOIN person pp ON pp.id = r.relation WHERE p.id = ?  and r.userid = ?";
      try {
        conn.query(sql, [id, userid], (err, result) => {
          if (err) {
            return res.json({ success: false, error: err });
          };
          let father = [0, 0, ""];
          let mother = [0, 0, ""];
          let spouse = [0, 0, ""];
          let sons = [];
          let daughters = [];
          let brothers = [];
          let sisters = [];
          let i;
          for (i = 0; i < result.length; i++) {
            if (result[i].relation === "Father") {
              father = new Array(result[i].id, result[i].personid, result[i].relative);
            };
            if (result[i].relation === "Mother") {
              mother = new Array(result[i].id, result[i].personid, result[i].relative);
            };
            if (result[i].relation === "Spouse") {
              spouse = new Array(result[i].id, result[i].personid, result[i].relative);
            };
            if (result[i].relation === "Son") {
              sons.push([result[i].id, result[i].personid, result[i].relative]);
            };
            if (result[i].relation === "Daughter") {
              daughters.push([result[i].id, result[i].personid, result[i].relative]);
            };
            if (result[i].relation === "Brother") {
              brothers.push([result[i].id, result[i].personid, result[i].relative]);
            };
            if (result[i].relation === "Sister") {
              sisters.push([result[i].id, result[i].personid, result[i].relative]);
            };
          };
          console.log({father, mother, spouse, sons, daughters, brothers, sisters});
          return res.json({ success: true, father:father, mother:mother, spouse:spouse, sons:sons, daughters:daughters, brothers:brothers, sisters:sisters } );
        });
      } catch (err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch (err) {
    return res.json({ success: false, error: err });
  };
});

///////////////////
//Delete Relation//
///////////////////
app.delete("/api/relation/:id", fetchuser, async (req, res) => {
  const id = req.params.id;
  let sql = "SELECT * FROM users WHERE username = ?";
  try {
    conn.query(sql, [req.username], (err, result) => {
      if (err) {
        return res.json({ success: false, error: err });
      };
      const userid = result[0].id;
      sql = "DELETE FROM relation WHERE userid = ? and id = ?";
      try{
        conn.query(sql, [userid, id], (err, result) => {
          if(err) {
            return res.json({success:false, error:err});
          };
          if(result.affectedRows){
            return res.json({success:true, message:"record deleted successfully"});
          } else {
            console.log(err);
            return res.json({ success: false, error: "Database Error" });
          };
        });
      } catch(err) {
        return res.json({ success: false, error: err });
      };
    });
  } catch(err) {
    return res.json({ success: false, error: err });
  };
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Listning on port ${port}`);
});

