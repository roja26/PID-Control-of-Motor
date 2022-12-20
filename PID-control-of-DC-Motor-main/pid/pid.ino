#include "analogWrite.h"
#include <time.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <ThingSpeak.h>
#include <HTTPClient.h>

HTTPClient http;
IPAddress ip;
WiFiClient client;
#define CSE_IP "esw-onem2m.iiit.ac.in"  
#define CSE_PORT 443
#define OM2M_ORGIN "nHP#Sx:i2iYGl"
#define OM2M_MN "/~/in-cse/in-name/"
#define OM2M_AE "Team-20"
#define OM2M_DATA_CONT "Node-1/Data"
#define INTERVAL 15000L

const char * ntpServer = "pool.ntp.org"; 


const char *ssid = "adyansh";
const char *password = "password";
const char *server = "mqtt3.thingspeak.com";

int writeChannelID = 1922377;
const char *writeAPIKey = "0EWEDZ5X4K5OT1B9";

const char *clientID = "KRwGOj0dFAcoDTw3Ky4aISs";
const char *mqttUser = clientID;
const char *mqttPwd = "oJFDlzrM/o4kx3Of1T5C7LrY";

int uploading = 0;

PubSubClient mqttClient(server,1883, client);

int IN1 = 18;
int IN2 = 19;
int PWM = 5;
int ENCA = 32;
int ENCB = 34;

volatile int posi = 0;
long prevT = 0;
float eprev = 0;
float eintegral = 0;

// PID constants
float kp = 10;
float kd = 0.025;
float ki = 5;

int fieldArray[] = {1,0,0,0,0,0,0,0};
int dataArray[] = {-1,-1,-1,-1,-1,-1,-1,-1};

uint lastTime = 0;
#define PID_TIMER 10000

void readEncoder(){
    int b = digitalRead(ENCB);
    if(b > 0){
        posi++;
    }
    else{
        posi--;
    }
}

void mqttPublish()
{
    String dataString = "";
    for(int i = 0; i < 8; i++){
      if(fieldArray[i] == 1){
          dataString += "field"+String(i+1)+"="+String(dataArray[i])+"&";
      }
    }
    dataString += "status=MQTTPUBLISH";
    Serial.println(dataString);
    String topicString = "channels/"+String(writeChannelID)+"/publish";

    mqttClient.publish(topicString.c_str(), dataString.c_str());
  
}
float input[4];
float target;
void mqttSubscriptionCallback( char* topic, byte* payload, unsigned int length ) {
//  if(uploading)
//    return;
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  int semi_c=0;
  int inpno=0;
  String inp_val="";
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
    if((char)payload[i]==':'){
      semi_c++;
      if(semi_c>5){
        while((char)payload[i+1]!=','){
          i++;
          inp_val+=(char)payload[i];
        }
        input[inpno]=inp_val.toFloat();
        inpno++;
        inp_val="";
      }
    }
    
  }
  kp = input[0];
  kd =  input[1];
  ki =  input[2];
  target= input[3];
  Serial.println(kp);
  Serial.println(ki);
  Serial.println(kd);
  Serial.println(target);
  Serial.println();
  
}

// Subscribe to ThingSpeak channel for updates.
void mqttSubscribe( long subChannelID ){
  
  String myTopic = "channels/"+String(subChannelID)+"/subscribe";
  Serial.println(mqttClient.subscribe(myTopic.c_str(),0));
  
}

void oneM2MPublish(float pos,float e){
  String data;
  String server = "https://" + String() + CSE_IP + ":" + String() + CSE_PORT + String() + OM2M_MN;

  http.begin(server + String() + OM2M_AE + "/" + OM2M_DATA_CONT + "/");

  http.addHeader("X-M2M-Origin", OM2M_ORGIN);
  http.addHeader("Content-Type", "application/json;ty=4");
  http.addHeader("Content-Length", "100");

  data = "[" + String(pos) + ", " + String(e) +   + "]"; 
  String req_data = String() + "{\"m2m:cin\": {"

    +
    "\"con\": \"" + data + "\","

    +
    "\"lbl\": \"" + "V1.0.0" + "\","

    //+ "\"rn\": \"" + "cin_"+String(i++) + "\","

    +
    "\"cnf\": \"text\""

    +
    "}}";
  int code = http.POST(req_data);
  http.end();
  Serial.println(code);
}

void setMotor(int dir, int pwmVal, int pwm, int in1, int in2){
    analogWrite(pwm,pwmVal);
    if(dir == 1){
        digitalWrite(in2,HIGH);
        digitalWrite(in1,LOW);
    }
    else if(dir == -1){
        digitalWrite(in2,LOW);
        digitalWrite(in1,HIGH);
    }
    else{
        digitalWrite(in1,LOW);
        digitalWrite(in2,LOW);
    }  
}

void PID_control(float target)
{
    
    uint startTime = millis();
    uint lastTime = millis();
    bool use_integral = false;
    int md = 0;
    
    while(millis()- startTime < PID_TIMER){
      while(mqttClient.connected() == NULL)
      {
        Serial.println("Connecting to mqTT server");
        mqttClient.connect(clientID, mqttUser, mqttPwd);
        mqttSubscribe(writeChannelID);
      }
      mqttClient.loop();
      if(millis() - lastTime > 100){
        setMotor(0,0,PWM,IN1,IN2);

        // time difference
        long currT = micros();
        float deltaT = ((float) (currT - prevT))/( 1.0e6 );
        prevT = currT;

        // Read the positionL
        float pos = 0; 
        // noInterrupts(); // disable interrupts temporarily while reading
        pos = (float)posi * 0.85714285714;
        // interrupts(); // turn interrupts back on

        // error
        float e = target - pos;

        if(mqttClient.connected() != NULL){
          while(mqttClient.connected() == NULL)
          {
            Serial.println("Connecting to mqTT server");
            mqttClient.connect(clientID, mqttUser, mqttPwd);     // ASK
            mqttSubscribe(writeChannelID);
          }
          mqttClient.loop();
        }

        dataArray[0] = pos;
        //dataArray[1] = e;
        uploading = 1;
        mqttPublish();
        //oneM2MPublish(pos,e);

        // derivative
        float dedt = (e-eprev)/(deltaT);

        // integral
        if(dedt == 0)
          use_integral = true;
        if (use_integral == true)
        {
            if (pos > target)
            {
              if (md == -1)
                eintegral = 0;
              md = 1;
            }
            else if (pos < target)
            {
              if (md == 1)
                eintegral = 0;
              md = -1;
            }
           
        
          eintegral = eintegral + e*deltaT;
        }

        // control signal
        float u = kp*e + kd*dedt + ki*eintegral;

        // motor power
        float pwr = fabs(u);
        if( pwr > 255 ){
            pwr = 255;
        }

        // motor direction
        int dir = 1;
        if(u<0){
            dir = -1;
        }

        // signal the motor
        setMotor(dir,pwr,PWM,IN1,IN2);


        // store previous error
        eprev = e;

        Serial.print(target);
        Serial.print(" ");
        Serial.print(pos);
        Serial.print(" ");
        Serial.print(e);
        Serial.print(" ");
        Serial.print(dedt);
        Serial.print(" ");
        Serial.print(eintegral);
        Serial.print(" ");
        Serial.print(pwr);
        Serial.println();
        lastTime = millis();

      }
    }
    uploading = 0;
}
void PID_reset(float target)
{
    
    uint startTime = millis();
    uint lastTime = millis();
    bool use_integral = false;
    int md = 0;
    
    while(millis()- startTime < PID_TIMER){
      if(millis() - lastTime > 100){
        setMotor(0,0,PWM,IN1,IN2);

        // time difference
        long currT = micros();
        float deltaT = ((float) (currT - prevT))/( 1.0e6 );
        prevT = currT;

        // Read the positionL
        float pos = 0; 
        // noInterrupts(); // disable interrupts temporarily while reading
        pos = (float)posi * 0.85714285714;
        // interrupts(); // turn interrupts back on

        // error
        float e = target - pos;

        // derivative
        float dedt = (e-eprev)/(deltaT);

        // integral
        if(dedt == 0)
          use_integral = true;
        if (use_integral == true)
        {
            if (pos > target)
            {
              if (md == -1)
                eintegral = 0;
              md = 1;
            }
            else if (pos < target)
            {
              if (md == 1)
                eintegral = 0;
              md = -1;
            }
        
          eintegral = eintegral + e*deltaT;
        }
        // control signal
        float u = kp*e + kd*dedt + ki*eintegral;
        // motor power
        float pwr = fabs(u);
        if( pwr > 255 ){
            pwr = 255;
        }
        // motor direction
        int dir = 1;
        if(u<0){
            dir = -1;
        }
        // signal the motor
        setMotor(dir,pwr,PWM,IN1,IN2);
        // store previous error
        eprev = e;
        lastTime = millis();

      }
    }
}
void setup() {
     // put your setup code here, to run once:
    Serial.begin(115200);

    
    Serial.print("Starting");
    pinMode(ENCA,INPUT);
    pinMode(ENCB,INPUT);
    attachInterrupt(digitalPinToInterrupt(ENCA),readEncoder,RISING);

    pinMode(PWM,OUTPUT);
//    analogWriteResolution(PWM, 8);
    pinMode(IN1,OUTPUT);
    pinMode(IN2,OUTPUT);
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    delay(1000);

    Serial.print("Starting");
    WiFi.begin(ssid, password);
  
    while (WiFi.status() != WL_CONNECTED)
    {
      delay(1000);
      Serial.println("Connecting to Wifi..");
    }
    Serial.println("Connected to the WiFi network.");
  
    Serial.println(WiFi.localIP());
    configTime(0, 0, ntpServer);
    mqttClient.setServer(server, 1883);
    mqttClient.setCallback(mqttSubscriptionCallback);
    mqttClient.setBufferSize(2048);
    while(mqttClient.connected() == NULL)
    {
      Serial.println("Connecting to mqTT server");
      mqttClient.connect(clientID, mqttUser, mqttPwd);
      mqttSubscribe(writeChannelID);
    }
}

void loop(){
  
  if (Serial.available() > 0) {
    target = Serial.parseInt();Serial.parseInt();

    Serial.print("I received: ");
    Serial.println(target);
    PID_control(target);
    //PID_reset(0);
    setMotor(0,0,PWM,IN1,IN2);
    
  }
//  while(mqttClient.connected() == NULL)
//  {
//    Serial.println("Connecting to mqTT server");
//    mqttClient.connect(clientID, mqttUser, mqttPwd);
//    mqttSubscribe(writeChannelID);
//  }
//  mqttClient.loop();
}
