//% color="#22c55e" weight=100 icon="\uf1e6" block="MakerLink"
//% groups='["Setup (On Start)", "Write (Actions)", "Read (Variables)", "Send (Update Dashboard)"]'
namespace makerlink {
    
    export enum MotorID { M1, M2, M3, M4 }
    export enum ServoID { S1, S2, S3, S4, S5, S6, S7, S8 }
    export enum MLPinMode { IN, OUT }
    export enum MLAnalogStream { A1, A2, A3, A4, A5, A6, A7, A8 }
    export enum MLDigitalStream { D1, D2, D3, D4, D5, D6, D7, D8 }
    export enum MLTextStream { T1, T2, T3, T4 }

    let initCommands: string[] = []; // Remembers the dashboard layout for SYNC
    let isInitialized = false;

    // Internal Memory
    let motorVals = [0, 0, 0, 0];
    let servoVals = [90, 90, 90, 90, 90, 90, 90, 90];
    let analogVals = [0, 0, 0, 0, 0, 0, 0, 0];
    let digitalVals = [0, 0, 0, 0, 0, 0, 0, 0];

    function getMotorStr(id: MotorID): string { return "M" + (id + 1); }
    function getServoStr(id: ServoID): string { return "S" + (id + 1); }
    function getAnalogStr(id: MLAnalogStream): string { return "A" + (id + 1); }
    function getDigitalStr(id: MLDigitalStream): string { return "D" + (id + 1); }
    function getTextStr(id: MLTextStream): string { return "T" + (id + 1); }

    function saveInitCmd(cmd: string) {
        let parts = cmd.split(":");
        if (parts.length < 2) return;
        let cardId = parts[1].split(",")[0];
        
        // Replace if exists, else push
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
        let splitIdx = cmd.indexOf(':');
        if (splitIdx === -1) return;
        let id = cmd.substr(0, splitIdx);
        let valStr = cmd.substr(splitIdx + 1);
        let val = parseInt(valStr);

        if (id.charAt(0) == 'M') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 3) motorVals[idx] = val;
        } else if (id.charAt(0) == 'S') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) servoVals[idx] = val;
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
        
        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            let cmd = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)).trim();
            
            // The Web App Handshake
            if (cmd === "SYNC") {
                // 1. Send UI Builders
                for(let i=0; i<initCommands.length; i++) {
                    bluetooth.uartWriteString(initCommands[i] + "\n");
                    basic.pause(30); 
                }
                // 2. Refresh physical states
                for(let i=0; i<4; i++) { bluetooth.uartWriteString("M"+(i+1)+":"+motorVals[i]+"\n"); basic.pause(10); }
                for(let i=0; i<8; i++) { bluetooth.uartWriteString("S"+(i+1)+":"+servoVals[i]+"\n"); basic.pause(10); }
                for(let i=0; i<8; i++) { bluetooth.uartWriteString("A"+(i+1)+":"+analogVals[i]+"\n"); basic.pause(10); }
                for(let i=0; i<8; i++) { bluetooth.uartWriteString("D"+(i+1)+":"+digitalVals[i]+"\n"); basic.pause(10); }
            } else {
                parseCommand(cmd);
            }
        });
        isInitialized = true;
    }

    /**
     * Initialize a DC Motor Card
     */
    //% block="⚙️ Init Motor Card $motor || Start $startVal CW Limit $cw CCW Limit $ccw"
    //% group="Setup (On Start)"
    //% weight=90
    export function initMotor(motor: MotorID, startVal: number = 0, cw: number = 255, ccw: number = -255): void {
        motorVals[motor] = startVal;
        let cmd = "INIT:" + getMotorStr(motor) + ",MOTOR," + startVal + "," + cw + "," + ccw;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize a Servo Card
     */
    //% block="🦾 Init Servo Card $servo || Start Angle $start Pos 1 $pos1 Pos 2 $pos2"
    //% group="Setup (On Start)"
    //% weight=89
    export function initServo(servo: ServoID, start: number = 90, pos1: number = 0, pos2: number = 180): void {
        servoVals[servo] = start;
        let cmd = "INIT:" + getServoStr(servo) + ",SERVO," + start + "," + pos1 + "," + pos2;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }
    
   

    //% block="📊 Init Analog Stream $stream | Mode $mode | Initial Val $val"
    //% group="Setup (On Start)"
    //% weight=88
    export function initAnalog(stream: MLAnalogStream, mode: MLPinMode, val: number): void {
        analogVals[stream] = val;
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        let cmd = "INIT:" + getAnalogStr(stream) + "," + mStr + "," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    //% block="🚥 Init Digital Stream $stream | Mode $mode | Initial Val $val"
    //% group="Setup (On Start)"
    //% weight=87
    export function initDigital(stream: MLDigitalStream, mode: MLPinMode, val: number): void {
        digitalVals[stream] = val;
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        let cmd = "INIT:" + getDigitalStr(stream) + "," + mStr + "," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

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

    //% block="MakerLink set servo $servo to $angle degrees"
    //% group="Write (Actions)"
    //% angle.min=0 angle.max=180
    //% weight=79
    export function setServo(servo: ServoID, angle: number): void {
        let val = Math.max(0, Math.min(180, angle));
        servoVals[servo] = val; 

        let mbServo = MotionBitServoChannel.S1;
        if (servo == ServoID.S2) mbServo = MotionBitServoChannel.S2;
        if (servo == ServoID.S3) mbServo = MotionBitServoChannel.S3;
        if (servo == ServoID.S4) mbServo = MotionBitServoChannel.S4;
        if (servo == ServoID.S5) mbServo = MotionBitServoChannel.S5;
        if (servo == ServoID.S6) mbServo = MotionBitServoChannel.S6;
        if (servo == ServoID.S7) mbServo = MotionBitServoChannel.S7;
        if (servo == ServoID.S8) mbServo = MotionBitServoChannel.S8;

        motionbit.setServoPosition(mbServo, val);
    }

    // ==============================================
    // REPORTER VARIABLES (READ)
    // ==============================================

    //% block="MakerLink Motor $motor value"
    //% group="Read (Variables)"
    //% weight=70
    export function getMotorValue(motor: MotorID): number { return motorVals[motor]; }

    //% block="MakerLink Servo $servo value"
    //% group="Read (Variables)"
    //% weight=69
    export function getServoValue(servo: ServoID): number { return servoVals[servo]; }

    //% block="MakerLink Analog Stream $stream value"
    //% group="Read (Variables)"
    //% weight=68
    export function getAnalogValue(stream: MLAnalogStream): number { return analogVals[stream]; }

    //% block="MakerLink Digital Stream $stream value"
    //% group="Read (Variables)"
    //% weight=67
    export function getDigitalValue(stream: MLDigitalStream): number { return digitalVals[stream]; }

    // ==============================================
    // SEND BLOCKS (UPDATE DASHBOARD)
    // ==============================================

    //% block="📤 Update Dashboard Analog Stream $stream to $val"
    //% group="Send (Update Dashboard)"
    //% weight=60
    export function sendAnalog(stream: MLAnalogStream, val: number): void {
        bluetooth.uartWriteString(getAnalogStr(stream) + ":" + val + "\n");
    }

    //% block="📤 Update Dashboard Digital Stream $stream to $val"
    //% group="Send (Update Dashboard)"
    //% weight=59
    export function sendDigital(stream: MLDigitalStream, val: number): void {
        bluetooth.uartWriteString(getDigitalStr(stream) + ":" + val + "\n");
    }

    //% block="📤 Update Dashboard Text Stream $stream to $val"
    //% group="Send (Update Dashboard)"
    //% weight=58
    export function sendTextStream(stream: MLTextStream, val: string): void {
        bluetooth.uartWriteString(getTextStr(stream) + ":" + val + "\n");
    }

    //% block="📤 Update Dashboard Motor $motor to $val"
    //% group="Send (Update Dashboard)"
    //% weight=57
    export function sendMotor(motor: MotorID, val: number): void {
        bluetooth.uartWriteString(getMotorStr(motor) + ":" + val + "\n");
    }

    //% block="📤 Update Dashboard Servo $servo to $val"
    //% group="Send (Update Dashboard)"
    //% weight=56
    export function sendServo(servo: ServoID, val: number): void {
        bluetooth.uartWriteString(getServoStr(servo) + ":" + val + "\n");
    }

    //% block="📤 Update Dashboard Terminal with $msg"
    //% group="Send (Update Dashboard)"
    //% weight=55
    export function sendTerminalMessage(msg: string): void {
        bluetooth.uartWriteString("LOG:" + msg + "\n");
    }
}
