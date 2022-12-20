import  JSONdb  from 'simple-json-db';
import nodemailer from 'nodemailer';
import generator from 'generate-password';
import { createClient } from 'redis';
import sessions from 'express-session';
import cookieParser from 'cookie-parser';
import http from 'https';
import  express  from 'express';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = createClient( {url : 'redis://redis-14520.c258.us-east-1-4.ec2.cloud.redislabs.com:14520/',
password : "nE98bsr6S6BYifGSpvNhhWaUNqsmlcUB"});

client.on('error', (err) => console.log('Redis Client Error', err));

await client.connect();

var session;

const PORT = process.env.PORT || 3000;
const app = express();
const oneDay = 1000 * 60 * 60 * 24;
app.use(cookieParser());
app.use(sessions({
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false 
}));
const db = new JSONdb('./UserCreds.json');

app.use(express.urlencoded({ extended: true}));

app.use(express.json());


//static files

app.get('/',(req,res)=>
{
  res.sendFile(__dirname+ '/static/index.html');
});

app.get('/static/sign_in/index.html',(req,res)=>
{
  res.sendFile(__dirname+ '/static/sign_in/index.html');
});

app.get('/static/sign_in/style.css',(req,res)=>
{
  res.sendFile(__dirname+ '/static/sign_in/style.css');
});

app.get('/static/sign_up/index.html',(req,res)=>
{
  res.sendFile(__dirname+ '/static/sign_up/index.html');
});

app.get('/static/sign_up/style.css',(req,res)=>
{
  res.sendFile(__dirname+ '/static/sign_up/style.css');
});

app.get('/static/scripts.js',(req,res)=>
{
  res.sendFile(__dirname+ '/static/scripts.js');
});

app.get('/static/style.css',(req,res)=>
{
  res.sendFile(__dirname+ '/static/style.css');
});

app.get('/static/vanta.net.min.js',(req,res)=>
{
  res.sendFile(__dirname+ '/static/vanta.net.min.js');
});

app.get('/static/index.html',(req,res)=>
{
  res.sendFile(__dirname+ '/static/index.html');
});

app.get('/static/experiment/index.html',(req,res)=>
{
  const cookies=parseCookies(req);
  const user=cookies['pid_user'];
  if(user=="no user loginned")
  {
    res.redirect("/");
  }
  else
    res.sendFile(__dirname+ '/static/experiment/index.html');
});

app.get('/static/experiment/style.css',(req,res)=>
{
  res.sendFile(__dirname+ '/static/experiment/style.css');
});

app.get('/static/experiment/scripts.js',(req,res)=>
{
  res.sendFile(__dirname+ '/static/experiment/scripts.js');
});

app.get('/static/experiments_page/index.html',(req,res)=>
{
  const cookies=parseCookies(req);
  const user=cookies['pid_user'];
  if(user=="no user loginned" || user==undefined)
  {
    res.redirect("/");
  }
  else
  {
    console.log(user);
    res.sendFile(__dirname+ '/static/experiments_page/index.html');
  }
});

app.get('/static/experiments_page/style.css',(req,res)=>
{
  res.sendFile(__dirname+ '/static/experiments_page/style.css');
});

app.get('/static/experiments_page/scripts.js',(req,res)=>
{
  res.sendFile(__dirname+ '/static/experiments_page/scripts.js');
});

app.get('/static/experiment_theory/index.html',(req,res)=>
{
  const cookies=parseCookies(req);
  const user=cookies['pid_user'];
  if(user=="no user loginned" || user==undefined)
  {
    res.redirect("/");
  }
  else
    res.sendFile(__dirname+ '/static/experiment_theory/index.html');
});

app.get('/static/experiment_theory/style.css',(req,res)=>
{
  res.sendFile(__dirname+ '/static/experiment_theory/style.css');
});

app.get('/static/experiment_theory/scripts.js',(req,res)=>
{
  res.sendFile(__dirname+ '/static/experiment_theory/scripts.js');
});

app.get('/static/instructions/index.html',(req,res) => 
{
  res.sendFile(__dirname+ '/static/instructions/index.html');
});

app.get('/static/instructions/style.css',(req,res) => 
{
  res.sendFile(__dirname+ '/static/instructions/style.css');
});

app.get('/getTimeSpent',(req,res)=>
{
  const cur=Date.now();
  const cookies=parseCookies(req);
  const user=cookies['pid_user'];
  if(user=="no user loginned" || user==undefined)
  {
    res.send("0");
  }
  else
  {
    res.send((((cur-loginTimedb.get(user)))/1000).toString());
  }
});
//parse cookie function
function parseCookies (request) {
  const list = {};
  const cookieHeader = request.headers?.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(`;`).forEach(function(cookie) {
      let [ name, ...rest] = cookie.split(`=`);
      name = name?.trim();
      if (!name) return;
      const value = rest.join(`=`).trim();
      if (!value) return;
      list[name] = decodeURIComponent(value);
  });
  return list;
}

//debug if the cookie is set
app.get("/debug",function(req,res)
{
  const cookies=parseCookies(req);
  console.log(cookies['pid_user']);
  res.send(cookies['pid_user']);
});

//this checks the user creds and sets in cookie
//
app.get("/login",function (req, res)
{
  const cookies=parseCookies(req);
  const user=cookies['pid_user'];
  if(user=="no user loginned" || user==undefined)
  {
    res.redirect("/static/sign_in/index.html");
  }
  else 
  {
    res.redirect("/static/experiments_page/index.html");
  }

});

app.post('/change_password',async (req,res)=>
{
  const cookies=parseCookies(req);
  var user=cookies['pid_user'];
  if(user=="no user loginned" || user==undefined)
  {
    res.redirect("/");
  }
  else 
  {
    const new_password=req.body.new_password;
    console.log(new_password);
    await client.set(user,new_password);
    db.set(user,new_password);
  }
});

app.post("/check",
async function (req, res) {
    const givenUsername=req.body.username;
    const givenPassword=req.body.password;
    var actualPassword=db.get(givenUsername);
    //actualPassword=await client.get(givenUsername);
    console.log(actualPassword);
    console.log(req.body.username);
    if(givenPassword==actualPassword)
    {
        session=req.session;
        session.userid=req.body.username;
        console.log(session.userid);
        res.cookie('pid_user', givenUsername);
        const cookies=parseCookies(req);
        console.log("lol");
        console.log(cookies['pid_user']);
        res.redirect("/static/experiments_page/index.html");
    }
    else
    {
        res.send("wrong password");
    }
});

//return  1 if successfully sent
//return -1 if there is an error
async function sendMailToUser(emailId,content)
{
  return new Promise((resolve,reject)=>{    
  const transporter = nodemailer.createTransport({
  port: 465,               // true for 465, false for other ports
  host: "smtp.gmail.com",
     auth: {
          user: 'zaidcoder@gmail.com',
          pass: 'bxmzigxhpndrqboj',
       },
  secure: true,
  });
  const mailData = {
    from: 'zaidcoder@gmail.com',  // sender address
      to: emailId,      // list of receivers
      subject: "password generated",
      text: content
    };
    transporter.sendMail(mailData, function (err, info) {
      if(err)
      {
        console.log(err);
        resolve(false); // or use rejcet(false) but then you will have to handle errors
      }
      else
      {
        console.log(info);
        resolve(true);
      }
   });
  });
} 

const callback = function(response) {
  var str = '';

  //another chunk of data has been received, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been received, so we just print it out here
  response.on('end', function () {
    console.log(str);
  });
}

// Posting to fields 2,3,4,5
function postToMQTT(body)
{
  var path='/update?api_key=0EWEDZ5X4K5OT1B9';
  path+='&field2=';
  path+=body.kp;
  path+='&field3='
  path+=body.ki;
  path+='&field4=';
  path+=body.kd;
  path+='&field5='
  path+=body.angle;
  var options = {
    host: 'api.thingspeak.com',
    path: path
  };
  http.request(options, callback).end();
}

app.post('/mqtt', async function(req,res){
  console.log(req.body);
  postToMQTT(req.body);
});

//
//this registers
app.post("/register",async function (req, res){
  const givenUsername=req.body.username;  //Body has username 
  const password = generator.generate({
    length: 10,
    numbers: true
  });
  console.log(password);
  const ret = await sendMailToUser(req.body.username,password);
  if(ret==true)
  {
    res.redirect("/");
    db.set(givenUsername,password);
    client.set(givenUsername,password);
  }
  else 
  {
    res.redirect("/");
  }
});

app.get('/logout', function(req,res){
  console.log("hey");
  res.cookie('pid_user', "no user loginned");
  res.redirect("/");
});

app.listen(PORT, function () {
    console.log(`Server is running on localhost:${PORT}`);
});
