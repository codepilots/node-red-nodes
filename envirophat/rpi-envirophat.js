/**
 * Copyright 2016 Pimoroni Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 
/**
 # Modified from the Explorer Hat source by Chris Thomson
 # 27/4/17 - Added handlers for temperature
*/

module.exports = function(RED) {
    "use strict";

    function REDvWarn(message){
        if( RED.settings.verbose ) RED.log.warn("EnviroPHAT: " + message);
    }
    
    function REDvInfo(message){
        if( RED.settings.verbose ) RED.log.info("EnviroPHAT: " + message);
    }

    var HAT = (function(){

        var fs = require("fs");
        var spawn = require("child_process").spawn;

        var cmd = __dirname+"/envirolink";
        var hat = null;
        var allowExit = false;
        var reconnectTimer = null;
        var disconnectTimeout = null;
        var users = [];

        if ( !(fs.statSync(cmd).mode & 1) ) {
            throw "Error: '" + cmd + "' must be executable (755)";
        }

        process.env.PYTHONBUFFERED = 1;

        var connect = function() {
            if( reconnectTimer ) clearTimeout(reconnectTimer);

            reconnectTimer = null;
            allowExit = false;

            hat = spawn(cmd);

            users.forEach(function(node){
                node.status({fill:"green",shape:"dot",text:"Connected"});
            });

            function handleMessage(data){
                data = data.trim();
                if (data.length == 0) return;

                if (data.substring(0,5) == "ERROR"){
                    REDvWarn(data);
                    return;
                }

                if (data.substring(0,5) == "FATAL"){
                    throw "Error: " + data;
                }

                users.forEach(function(node){
                	//Handle incomming messages from Python here
                	
                    if ( data.substring(0,4) == "temp" && node.send_temp ){
                        var msg = data.split(":")[1];

                        node.send({topic:"envirophat/temp", payload:Number(msg)});
                    }
                });

            }

			// This reads the data stream comming fromt the Python link
            hat.stdout.on('data', function(data) {
                data = data.toString().trim();
                if (data.length == 0) return;

                var messages = data.split("\n");
                messages.forEach(function(message){
                    handleMessage(message);
                });
                //REDvInfo("Got Data: " + data + " :");

            });

            hat.stderr.on('data', function(data) {
                REDvWarn("Process Error: "+data+" :");

                hat.stdin.write("stop");
                hat.kill("SIGKILL");
            });

            hat.on('close', function(code) {
                REDvWarn("Process Exit: "+code+" :");

                hat = null;
                users.forEach(function(node){
                    node.status({fill:"red",shape:"circle",text:"Disconnected"});
                });

                if (!allowExit && !reconnectTimer){
                    REDvInfo("Attempting Reconnect");

                    reconnectTimer = setTimeout(function(){
                        connect();
                    },5000);
                }

            });

        }

        var disconnect = function(){
            disconnectTimeout = setTimeout(function(){
                if (hat !== null) {
                    allowExit = true;
                    hat.stdin.write("stop\n");
                    hat.kill("SIGKILL");
                }
            },3000);
            if (reconnectTimer) {
                clearTimeout(reconnedTimer);
            }

        }

        return {
            open: function(node){
                if (disconnectTimeout) clearTimeout(disconnectTimeout);
                if (!hat) connect();

                if(!reconnectTimer){
                    node.status({fill:"green",shape:"dot",text:"Connected"});
                }

                REDvInfo("Adding node, temp: " + (node.send_temp ? "yes" : "no") );

                users.push(node);
            },
            close: function(node,done){
                users.splice(users.indexOf(node),1);
                
                REDvInfo("Removing node, count: " + users.length.toString());

                if(users.length === 0){
                    disconnect();
                }
            },
            send: function(msg){
                if(hat) hat.stdin.write(msg+"\n");
            }
        }


    })();


    function EnviroPHAT(config) {
        RED.nodes.createNode(this,config);

        this.send_temp = config.temp;

        var node = this;

        node.status({fill:"red",shape:"ring",text:"Disconnected"});

        REDvInfo("Initialising node");

        HAT.open(this);
        
        node.on("input", function(msg) {
            if (node.send_temp){
                HAT.send("temp:" + msg.payload.toString());
                REDvInfo("Sending Command: temp :" + msg.payload.toString());
            }
        });

        node.on("close", function(done) {
            HAT.close(this);
            done();
            REDvInfo("Node Closed");
        });
    }

    RED.nodes.registerType("rpi-envirophat",EnviroPHAT);
}
