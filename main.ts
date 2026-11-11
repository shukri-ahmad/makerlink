/**
 * MakerLink Cyber-Physical Control System
 * 2-Way Bluetooth SCADA Bridge
 */
//% color="#2563eb" weight=100 icon="\uf0c1" block="MakerLink"
namespace makerlink {
    export enum ServoID { S1, S2, S3, S4, S5, S6 }
    export enum MotorID { M1, M2, M3, M4 }
    export enum MLAnalogStream { A1, A2, A3, A4 }
    export enum MLDigitalStream { D1, D2, D3, D4 }
    export enum MLTextStream { T1, T2, T3 }
    export enum MLAudioID { B1, B2 }
    
    export enum MLPinMode {
        //% block="Input (Sensor)"
        IN,
        //% block="Output (LED/Relay)"
        OUT,
        //% block="Push Button"
        PUSH
    }

    export enum MLAudioSound {
        //% block="🚨 Siren"
        Siren,
        //% block="🔔 Chime"
        Chime,
        //% block="📟 Beep"
        Beep
    }

    export enum MLAudioMode {
        //% block="Loop Continuous"
        Loop,
        //% block="Play Once"
        Once
    }

    let isInitialized = false;

    //% block="📡 Initialize MakerLink"
    //% group="1. Setup"
    //% weight=100
    export function initialize(): void {
        bluetooth.startUartService();
        isInitialized = true;
    }

    // --- AUDIO CARDS ---
    //% block="🔊 Init Audio Card $id"
    //% group="2. Audio Alerts"
    //% weight=90
    export function initAudio(id: MLAudioID): void {
        let idStr = "B" + (id + 1);
        bluetooth.uartWriteString("INIT:" + idStr + ",,STOP\n");
        basic.pause(50);
    }

    //% block="🔊 Play Audio $id | Sound: $sound | Mode: $mode"
    //% group="2. Audio Alerts"
    export function playAudio(id: MLAudioID, sound: MLAudioSound, mode: MLAudioMode): void {
        let idStr = "B" + (id + 1);
        let sStr = "BEEP";
        if (sound == MLAudioSound.Siren) sStr = "SIREN";
        if (sound == MLAudioSound.Chime) sStr = "CHIME";
        
        let mStr = "ONCE";
        if (mode == MLAudioMode.Loop) mStr = "LOOP";
        bluetooth.uartWriteString(idStr + ":PLAY:" + sStr + ":" + mStr + "\n");
    }

    //% block="🔊 Stop Audio $id"
    //% group="2. Audio Alerts"
    export function stopAudio(id: MLAudioID): void {
        let idStr = "B" + (id + 1);
        bluetooth.uartWriteString(idStr + ":STOP\n");
    }

    // --- SENSORS & DIGITAL ---
    //% block="📊 Init Analog $id as $mode | Default: $defaultVal"
    //% group="3. Sensors & I/O"
    export function initAnalog(id: MLAnalogStream, mode: MLPinMode, defaultVal: number): void {
        let idStr = "A" + (id + 1);
        let modeStr = (mode == MLPinMode.IN) ? "IN" : "OUT";
        bluetooth.uartWriteString("INIT:" + idStr + "," + modeStr + "," + defaultVal + "\n");
        basic.pause(50);
    }

    //% block="📤 Update Analog $id to $val"
    //% group="3. Sensors & I/O"
    export function sendAnalog(id: MLAnalogStream, val: number): void {
        let idStr = "A" + (id + 1);
        bluetooth.uartWriteString(idStr + ":" + val + "\n");
    }

    //% block="🚥 Init Digital $id as $mode | Default: $defaultVal"
    //% group="3. Sensors & I/O"
    export function initDigital(id: MLDigitalStream, mode: MLPinMode, defaultVal: number): void {
        let idStr = "D" + (id + 1);
        let modeStr = (mode == MLPinMode.IN) ? "IN" : (mode == MLPinMode.OUT ? "OUT" : "PUSH");
        bluetooth.uartWriteString("INIT:" + idStr + "," + modeStr + "," + defaultVal + "\n");
        basic.pause(50);
    }

    //% block="📤 Update Digital $id to $val"
    //% group="3. Sensors & I/O"
    export function sendDigital(id: MLDigitalStream, val: number): void {
        let idStr = "D" + (id + 1);
        bluetooth.uartWriteString(idStr + ":" + val + "\n");
    }

    // --- MOTORS & SERVOS ---
    //% block="⚙️ Init Motor $id | CW Speed: $cwSpeed | CCW Speed: $ccwSpeed"
    //% group="4. Motors & Servos"
    export function initMotor(id: MotorID, cwSpeed: number = 255, ccwSpeed: number = 255): void {
        let idStr = "M" + (id + 1);
        bluetooth.uartWriteString("INIT:" + idStr + ",,0," + cwSpeed + "," + ccwSpeed + "\n");
        basic.pause(50);
    }

    //% block="📤 Update Dashboard Motor $id to speed $speed"
    //% group="4. Motors & Servos"
    export function sendMotor(id: MotorID, speed: number): void {
        let idStr = "M" + (id + 1);
        bluetooth.uartWriteString(idStr + ":" + speed + "\n");
    }

    //% block="🦾 Init Servo $id | Start: $startPos | Limit 1: $pos1 | Limit 2: $pos2"
    //% group="4. Motors & Servos"
    export function initServo(id: ServoID, startPos: number, pos1: number = 0, pos2: number = 180): void {
        let idStr = "S" + (id + 1);
        bluetooth.uartWriteString("INIT:" + idStr + ",," + startPos + "," + pos1 + "," + pos2 + "\n");
        basic.pause(50);
    }

    //% block="🦾 Set physical Servo $id to $angle (Step delay $delay ms)"
    //% group="4. Motors & Servos"
    export function setServo(id: ServoID, angle: number, delay: number): void {
        let pin = AnalogPin.P1;
        if (id == ServoID.S1) pin = AnalogPin.P1;
        else if (id == ServoID.S2) pin = AnalogPin.P2;
        pins.servoWritePin(pin, angle);
        basic.pause(delay);
    }

    //% block="📤 Update Dashboard Servo $id to $angle"
    //% group="4. Motors & Servos"
    export function sendServo(id: ServoID, angle: number): void {
        let idStr = "S" + (id + 1);
        bluetooth.uartWriteString(idStr + ":" + angle + "\n");
    }

    // --- TEXT & LOGS ---
    //% block="📝 Init Text Stream $id | Initial text $startTxt"
    //% group="5. Display"
    export function initText(id: MLTextStream, startTxt: string): void {
        let idStr = "T" + (id + 1);
        bluetooth.uartWriteString("INIT:" + idStr + ",," + startTxt + "\n");
        basic.pause(50);
    }

    //% block="📤 Update Text Stream $id to $txt"
    //% group="5. Display"
    export function sendTextStream(id: MLTextStream, txt: string): void {
        let idStr = "T" + (id + 1);
        bluetooth.uartWriteString(idStr + ":" + txt + "\n");
    }

    //% block="💻 Send Terminal Log $msg"
    //% group="5. Display"
    export function sendTerminalLog(msg: string): void {
        bluetooth.uartWriteString("LOG:" + msg + "\n");
    }
}
