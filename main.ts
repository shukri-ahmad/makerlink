//% color="#22c55e" weight=100 icon="\uf1e6" block="MakerLink"
//% groups='["Setup (On Start)", "Write (Actions)", "Read (Variables)", "Send (Update Dashboard)"]'
namespace makerlink {
    
    // ==============================================
    // DROPDOWN MENUS (ENUMS)
    // ==============================================
    export enum MotorID { M1, M2, M3, M4 }
    export enum ServoID { S1, S2, S3, S4, S5, S6, S7, S8 }
    export enum MLPinMode { IN, OUT }
    export enum MLAnalogStream { A1, A2, A3, A4, A5, A6, A7, A8 }
    export enum MLDigitalStream { D1, D2, D3, D4, D5, D6, D7, D8 }
    export enum MLTextStream { T1, T2, T3, T4 }

    // ==============================================
    // INTERNAL STATE & MEMORY
    // ==============================================
    let initCommands: string[] = []; 
    let isInitialized = false;

    let motorVals = [0, 0, 0, 0];
    
    // Hardware Servo Timing Arrays
    let servoVals = [90, 90, 90, 90, 90, 90, 90, 90]; // Target Angle
    let servoCurrent = [90, 90, 90, 90, 90, 90, 90, 90]; // Current Physical Angle
    let servoDelay = [0, 0, 0, 0, 0, 0, 0, 0]; // Speed/Delay ms
    let servoLast = [0, 0, 0, 0, 0, 0, 0, 0]; // Timestamps
    
    let analogVals = [0, 0, 0, 0, 0, 0, 0, 0];
    let digitalVals = [0, 0, 0, 0, 0, 0, 0, 0];

    // ==============================================
    // UTILITIES
    // ==============================================
    function getMotorStr(id: MotorID): string { return "M" + (id + 1); }
    function getServoStr(id: ServoID): string { return "S" + (id + 1); }
    function getAnalogStr(id: MLAnalogStream): string { return "A" + (id + 1); }
    function getDigitalStr(id: MLDigitalStream): string { return "D" + (id + 1); }
    function getTextStr(id: MLTextStream): string { return "T" + (id + 1); }

    function applyServoPhysical(idx: number, val: number) {
        let mbServo = MotionBitServoChannel.S1;
        if (idx == 1) mbServo = MotionBitServoChannel.S2;
        if (idx == 2) mbServo = MotionBitServoChannel.S3;
        if (idx == 3) mbServo = MotionBitServoChannel.S4;
        if (idx == 4) mbServo = MotionBitServoChannel.S5;
        if (idx == 5) mbServo = MotionBitServoChannel.S6;
        if (idx == 6) mbServo = MotionBitServoChannel.S7;
        if (idx == 7) mbServo = MotionBitServoChannel.S8;
        motionbit.setServoPosition(mbServo, val);
    }

    function saveInitCmd(cmd: string) {
        let parts = cmd.split(":");
        if (parts.length < 2) return;
        let cardId = parts[1].split(",")[0];
        
        let replaced = false;
        for(let i=0; i<initCommands.length; i++) {
            if(initCommands[i].indexOf("INIT:" + cardId) === 0) {
                initCommands[i] = cmd;
                replaced = true;
                break;
            }
        }
        if(!replaced) initCommands.push(cmd);
    }

    function parseCommand(cmd: string) {
        let parts = cmd.split(':');
        if (parts.length < 2) return;
        let id = parts[0];
        let val = parseInt(parts[1]);

        if (id.charAt(0) == 'M') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 3) motorVals[idx] = val;
        } else if (id.charAt(0) == 'S') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) {
                servoVals[idx] = val; 
                if (parts.length >= 3) {
                    servoDelay[idx] = Math.max(0, parseInt(parts[2]));
                }
            }
        } else if (id.charAt(0) == 'A') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) analogVals[idx] = val;
        } else if (id.charAt(0) == 'D') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) digitalVals[idx] = val;
        }
    }

   // ==============================================
    // SETUP BLOCKS (on start)
    // ==============================================

   /**
     * Initializes MakerLink Bluetooth and listens for the Web App SYNC handshake.
     */
    //% block="📡 MakerLink: Initialize"
    //% group="Setup (On Start)"
    //% weight=100
    export function initialize(): void {
        if (isInitialized) return;
        bluetooth.startUartService();
        
        control.inBackground(function() {
            while(true) {
                let now = control.millis();
                for (let i = 0; i < 8; i++) {
                    if (servoCurrent[i] !== servoVals[i]) {
                        if (servoDelay[i] <= 0) {
                            servoCurrent[i] = servoVals[i]; 
                            applyServoPhysical(i, servoCurrent[i]);
                        } else {
                            if (now - servoLast[i] >= servoDelay[i]) {
                                servoLast[i] = now;
                                if (servoCurrent[i] < servoVals[i]) servoCurrent[i]++;
                                else servoCurrent[i]--;
                                applyServoPhysical(i, servoCurrent[i]);
                            }
                        }
                    }
                }
                basic.pause(5); 
            }
        });
        
        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            let cmd = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)).trim();
            
            if (cmd === "SYNC") {
                for(let i=0; i<initCommands.length; i++) {
                    bluetooth.uartWriteString(initCommands[i] + "\n");
                    basic.pause(30); 
                }
                
                for(let i=0; i<initCommands.length; i++) {
                    let parts = initCommands[i].split(":");
                    if (parts.length >= 2) {
                        let id = parts[1].split(",")[0];
                        let val = 0;
                        let valid = false;
                        
                        if (id.charAt(0) == 'M') { val = motorVals[parseInt(id.charAt(1)) - 1]; valid = true; }
                        else if (id.charAt(0) == 'S') { val = servoVals[parseInt(id.charAt(1)) - 1]; valid = true; }
                        else if (id.charAt(0) == 'A') { val = analogVals[parseInt(id.charAt(1)) - 1]; valid = true; }
                        else if (id.charAt(0) == 'D') { val = digitalVals[parseInt(id.charAt(1)) - 1]; valid = true; }
                        
                        if (valid) {
                            bluetooth.uartWriteString(id + ":" + val + "\n");
                            basic.pause(30);
                        }
                    }
                }
            } else {
                parseCommand(cmd);
            }
        });
        isInitialized = true;
    }

    /**
     * Initialize a DC Motor Card
     */
    //% block="⚙️ Init Motor Card $motor | Start $startVal | CW Limit $cw | CCW Limit $ccw"
    //% startVal.defl=0 cw.defl=255 ccw.defl=255
    //% group="Setup (On Start)"
    //% weight=90
    export function initMotor(motor: MotorID, startVal: number, cw: number, ccw: number): void {
        runMotor(motor, startVal); // FIX: Physically applies speed on boot
        let cmd = "INIT:" + getMotorStr(motor) + ",MOTOR," + startVal + "," + cw + "," + ccw;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize a Servo Card
     */
    //% block="🦾 Init Servo Card $servo | Start Angle $start | Pos 1 $pos1 | Pos 2 $pos2"
    //% start.defl=90 pos1.defl=0 pos2.defl=180
    //% group="Setup (On Start)"
    //% weight=89
    export function initServo(servo: ServoID, start: number, pos1: number, pos2: number): void {
        servoVals[servo] = start;
        servoCurrent[servo] = start;
        servoDelay[servo] = 0;
        
        applyServoPhysical(servo, start); // FIX: Physically jumps to start angle on boot!

        let cmd = "INIT:" + getServoStr(servo) + ",SERVO," + start + "," + pos1 + "," + pos2;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize an Analog Data Stream
     */
    //% block="📊 Init Analog Stream $stream | Mode $mode | Initial Val $val"
    //% val.defl=0
    //% group="Setup (On Start)"
    //% weight=88
    export function initAnalog(stream: MLAnalogStream, mode: MLPinMode, val: number): void {
        if (mode == MLPinMode.OUT) { writeAnalog(stream, val); } // FIX: Physically write if OUT
        else { analogVals[stream] = val; }
        
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        let cmd = "INIT:" + getAnalogStr(stream) + "," + mStr + "," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize a Digital Data Stream
     */
    //% block="🚥 Init Digital Stream $stream | Mode $mode | Initial Val $val"
    //% val.defl=0
    //% group="Setup (On Start)"
    //% weight=87
    export function initDigital(stream: MLDigitalStream, mode: MLPinMode, val: number): void {
        if (mode == MLPinMode.OUT) { writeDigital(stream, val); } // FIX: Physically write if OUT
        else { digitalVals[stream] = val; }

        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        let cmd = "INIT:" + getDigitalStr(stream) + "," + mStr + "," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize a Text Data Stream
     */
    //% block="📝 Init Text Stream $stream | Initial Text $val"
    //% group="Setup (On Start)"
    //% weight=86
    export function initText(stream: MLTextStream, val: string): void {
        let cmd = "INIT:" + getTextStr(stream) + ",TEXT," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    // ==============================================
    // ACTION BLOCKS (AUTO-CONTROL)
    // ==============================================

    /**
     * Runs the motor (-255 to 255)
     */
    //% block="MakerLink run motor $motor at speed $speed"
    //% group="Write (Actions)"
    //% speed.min=-255 speed.max=255
    //% weight=80
    export function runMotor(motor: MotorID, speed: number): void {
        let val = Math.max(-255, Math.min(255, speed));
        motorVals[motor] = val; 

        let mbMotor = MotionBitMotorChannel.M1;
        if (motor == MotorID.M2) mbMotor = MotionBitMotorChannel.M2;
        if (motor == MotorID.M3) mbMotor = MotionBitMotorChannel.M3;
        if (motor == MotorID.M4) mbMotor = MotionBitMotorChannel.M4;
                                                      
        if (val > 0) motionbit.runMotor(mbMotor, MotionBitMotorDirection.Forward, val);
        else if (val < 0) motionbit.runMotor(mbMotor, MotionBitMotorDirection.Backward, Math.abs(val));
        else motionbit.runMotor(mbMotor, MotionBitMotorDirection.Forward, 0);
    }

    /**
     * Sets the servo angle smoothly in hardware. 
     */
    //% block="MakerLink set servo $servo to $angle degrees || with delay $delay ms"
    //% group="Write (Actions)"
    //% expandableArgumentMode="toggle"
    //% angle.min=0 angle.max=180
    //% delay.defl=0
    //% weight=79
    export function setServo(servo: ServoID, angle: number, delay: number = 0): void {
        let val = Math.max(0, Math.min(180, angle));
        servoVals[servo] = val; 
        servoDelay[servo] = Math.max(0, delay); 
    }

    /**
     * Physical Analog write mapping (0 to 1023)
     */
    //% block="MakerLink write analog stream $stream to $val"
    //% group="Write (Actions)"
    //% val.min=0 val.max=1023
    //% weight=78
    export function writeAnalog(stream: MLAnalogStream, val: number): void {
        let v = Math.max(0, Math.min(1023, val));
        analogVals[stream] = v; 
        
        let ap = AnalogPin.P0;
        if (stream == MLAnalogStream.A2) ap = AnalogPin.P1;
        if (stream == MLAnalogStream.A3) ap = AnalogPin.P2;
        pins.analogWritePin(ap, v);
    }

    /**
     * Physical Digital write mapping (0 or 1)
     */
    //% block="MakerLink write digital stream $stream to $val"
    //% group="Write (Actions)"
    //% val.min=0 val.max=1
    //% weight=77
    export function writeDigital(stream: MLDigitalStream, val: number): void {
        let v = val > 0 ? 1 : 0; 
        
        if(stream == MLDigitalStream.D1) digitalVals[0] = v;
        else if(stream == MLDigitalStream.D2) digitalVals[1] = v;
        else if(stream == MLDigitalStream.D3) digitalVals[2] = v;
        else if(stream == MLDigitalStream.D4) digitalVals[3] = v;
        else if(stream == MLDigitalStream.D5) digitalVals[4] = v;
        else if(stream == MLDigitalStream.D6) digitalVals[5] = v;
        else if(stream == MLDigitalStream.D7) digitalVals[6] = v;
        else if(stream == MLDigitalStream.D8) digitalVals[7] = v;

        let dp = DigitalPin.P9;
        if (stream == MLDigitalStream.D2) dp = DigitalPin.P12;
        if (stream == MLDigitalStream.D3) dp = DigitalPin.P13;
        if (stream == MLDigitalStream.D4) dp = DigitalPin.P14;
        if (stream == MLDigitalStream.D5) dp = DigitalPin.P15;
        if (stream == MLDigitalStream.D6) dp = DigitalPin.P16;
        pins.digitalWritePin(dp, v);
    }

    // ==============================================
    // REPORTER VARIABLES (READ)
    // ==============================================

    /**
     * Read the latest Motor value received from the Web App
     */
    //% block="MakerLink Motor $motor value"
    //% group="Read (Variables)"
    //% weight=70
    export function getMotorValue(motor: MotorID): number { return motorVals[motor]; }

    /**
     * Read the latest Target Servo angle received from the Web App
     */
    //% block="MakerLink Servo $servo value"
    //% group="Read (Variables)"
    //% weight=69
    export function getServoValue(servo: ServoID): number { return servoVals[servo]; }

    /**
     * Read the latest Analog Stream value received from the Web App
     */
    //% block="MakerLink Analog Stream $stream value"
    //% group="Read (Variables)"
    //% weight=68
    export function getAnalogValue(stream: MLAnalogStream): number { return analogVals[stream]; }

    /**
     * Read the latest Digital Stream state received from the Web App
     */
    //% block="MakerLink Digital Stream $stream value"
    //% group="Read (Variables)"
    //% weight=67
    export function getDigitalValue(stream: MLDigitalStream): number { return digitalVals[stream]; }

    // ==============================================
    // SEND BLOCKS (UPDATE DASHBOARD)
    // ==============================================

    /**
     * Send Analog Stream data to update the Web App Chart
     */
    //% block="📤 Update Dashboard Analog Stream $stream to $val"
    //% group="Send (Update Dashboard)"
    //% weight=60
    export function sendAnalog(stream: MLAnalogStream, val: number): void {
        bluetooth.uartWriteString(getAnalogStr(stream) + ":" + val + "\n");
    }

    /**
     * Send Digital Stream data to update the Web App State
     */
    //% block="📤 Update Dashboard Digital Stream $stream to $val"
    //% group="Send (Update Dashboard)"
    //% weight=59
    export function sendDigital(stream: MLDigitalStream, val: number): void {
        bluetooth.uartWriteString(getDigitalStr(stream) + ":" + val + "\n");
    }

    /**
     * Send Text data to update the Web App Text Display
     */
    //% block="📤 Update Dashboard Text Stream $stream to $val"
    //% group="Send (Update Dashboard)"
    //% weight=58
    export function sendTextStream(stream: MLTextStream, val: string): void {
        bluetooth.uartWriteString(getTextStr(stream) + ":" + val + "\n");
    }

    /**
     * Override the Web App Motor slider position
     */
    //% block="📤 Update Dashboard Motor $motor to $val"
    //% group="Send (Update Dashboard)"
    //% weight=57
    export function sendMotor(motor: MotorID, val: number): void {
        bluetooth.uartWriteString(getMotorStr(motor) + ":" + val + "\n");
    }

    /**
     * Override the Web App Servo angle text
     */
    //% block="📤 Update Dashboard Servo $servo to $val"
    //% group="Send (Update Dashboard)"
    //% weight=56
    export function sendServo(servo: ServoID, val: number): void {
        bluetooth.uartWriteString(getServoStr(servo) + ":" + val + "\n");
    }

    /**
     * Sends a custom text log to the Web Dashboard Terminal.
     * @param msg The message to send
     */
    //% block="📤 Update Dashboard Terminal $msg"
    //% group="Communication & Telemetry"
    //% weight=70
    export function sendTerminalLog(msg: string): void {
        bluetooth.uartWriteString("LOG:" + msg + "\n");
    }
}
