//% color="#22c55e" weight=100 icon="\uf1e6" block="MakerLink"
//% groups='["Setup (On Start)", "Hardware Link", "Write (Actions)", "Read (Variables)", "Send (Update Dashboard)"]'
namespace makerlink {
    
    // ==============================================
    // DROPDOWN MENUS (ENUMS)
    // ==============================================
    export enum MotorID { M1, M2, M3, M4 }
    export enum ServoID { S1, S2, S3, S4, S5, S6, S7, S8 }
    export enum MLPinMode { IN, OUT, PUSH }
    export enum MLPinModeText { IN, OUT }
    export enum MLAnalogStream { A1, A2, A3, A4, A5, A6, A7, A8 }
    export enum MLDigitalStream { D1, D2, D3, D4, D5, D6, D7, D8 }
    export enum MLTextStream { T1, T2, T3, T4 }
    
    export enum MLAction {
        //% block="Write"
        Write,
        //% block="Read"
        Read
    }

    // --- AUDIO ENUMS ---
    export enum MLAudioID { B1, B2, B3, B4 }
    export enum MLAudioSound {
        //% block="🚨 Siren"
        Siren,
        //% block="🔔 Chime"
        Chime,
        //% block="📟 Beep"
        Beep
    }
    export enum MLAudioMode {
        //% block="Play Once"
        Once,
        //% block="Loop Continuous"
        Loop
    }

    // ==============================================
    // INTERNAL STATE & MEMORY
    // ==============================================
    let initCommands: string[] = []; 
    let isInitialized = false;

    let motorVals = [0, 0, 0, 0];
    let servoVals = [90, 90, 90, 90, 90, 90, 90, 90]; 
    let servoCurrent = [90, 90, 90, 90, 90, 90, 90, 90]; 
    let servoDelay = [0, 0, 0, 0, 0, 0, 0, 0]; 
    let servoLast = [0, 0, 0, 0, 0, 0, 0, 0]; 
    
    // Safety Limits
    let servoMin = [0, 0, 0, 0, 0, 0, 0, 0];
    let servoMax = [180, 180, 180, 180, 180, 180, 180, 180];
    
    let analogVals = [0, 0, 0, 0, 0, 0, 0, 0];
    let digitalVals = [0, 0, 0, 0, 0, 0, 0, 0];
    let textVals = ["", "", "", ""];

    // ==============================================
    // UTILITIES
    // ==============================================
    function getMotorStr(id: MotorID): string { return "M" + (id + 1); }
    function getServoStr(id: ServoID): string { return "S" + (id + 1); }
    function getAnalogStr(id: MLAnalogStream): string { return "A" + (id + 1); }
    function getDigitalStr(id: MLDigitalStream): string { return "D" + (id + 1); }
    function getTextStr(id: MLTextStream): string { return "T" + (id + 1); }
    function getAudioStr(id: MLAudioID): string { return "B" + (id + 1); }

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
        let valStr = parts[1];
        let val = parseInt(valStr);

        if (id.charAt(0) == 'M') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 3) motorVals[idx] = val;
        } else if (id.charAt(0) == 'S') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) {
                let boundedVal = Math.max(servoMin[idx], Math.min(servoMax[idx], val));
                servoVals[idx] = boundedVal; 
                servoDelay[idx] = 0; 
                if (val !== boundedVal) {
                    bluetooth.uartWriteString("S" + (idx + 1) + ":" + boundedVal + "\n");
                }
            }
        } else if (id.charAt(0) == 'A') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) analogVals[idx] = val;
        } else if (id.charAt(0) == 'D') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 7) digitalVals[idx] = val;
        } else if (id.charAt(0) == 'T') {
            let idx = parseInt(id.charAt(1)) - 1;
            if (idx >= 0 && idx <= 3) textVals[idx] = valStr; // Saves incoming string to buffer
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
                control.inBackground(function() {
                    for(let i=0; i<initCommands.length; i++) {
                        bluetooth.uartWriteString(initCommands[i] + "\n");
                        basic.pause(50);
                    }
                    for(let i=0; i<initCommands.length; i++) {
                        let parts = initCommands[i].split(":");
                        if (parts.length >= 2) {
                            let id = parts[1].split(",")[0];
                            let valStr = "";
                            let valid = false;
                            
                            if (id.charAt(0) == 'M') { valStr = motorVals[parseInt(id.charAt(1)) - 1].toString(); valid = true; }
                            else if (id.charAt(0) == 'S') { valStr = servoVals[parseInt(id.charAt(1)) - 1].toString(); valid = true; }
                            else if (id.charAt(0) == 'A') { valStr = analogVals[parseInt(id.charAt(1)) - 1].toString(); valid = true; }
                            else if (id.charAt(0) == 'D') { valStr = digitalVals[parseInt(id.charAt(1)) - 1].toString(); valid = true; }
                            
                            if (valid) {
                                bluetooth.uartWriteString(id + ":" + valStr + "\n");
                                basic.pause(50);
                            }
                        }
                    }
                });
            } else {
                parseCommand(cmd);
            }
        });
        isInitialized = true;
    }

    /**
     * Initialize a DC Motor Card
     */
    //% block="⚙️ Init Motor Card $motor || start speed $startVal limit CW $cw CCW $ccw"
    //% inlineInputMode=inline
    //% expandableArgumentMode="toggle"
    //% startVal.defl=0 cw.defl=255 ccw.defl=255
    //% group="Setup (On Start)"
    //% weight=90
    export function initMotor(motor: MotorID, startVal: number = 0, cw: number = 255, ccw: number = 255): void {
        runMotor(motor, startVal); 
        let cmd = "INIT:" + getMotorStr(motor) + ",MOTOR," + startVal + "," + cw + "," + ccw;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize a Servo Card
     */
    //% block="🦾 Init Servo Card $servo || start $start° delay $delay ms limits $pos1° to $pos2°"
    //% inlineInputMode=inline
    //% expandableArgumentMode="toggle"
    //% start.defl=90 delay.defl=15 pos1.defl=0 pos2.defl=180
    //% group="Setup (On Start)"
    //% weight=89
    export function initServo(servo: ServoID, start: number = 90, delay: number = 15, pos1: number = 0, pos2: number = 180): void {
        servoMin[servo] = Math.min(pos1, pos2);
        servoMax[servo] = Math.max(pos1, pos2);
        let safeStart = Math.max(servoMin[servo], Math.min(servoMax[servo], start));
        
        servoVals[servo] = safeStart;
        servoDelay[servo] = Math.max(0, delay);
        
        if (servoDelay[servo] > 0) {
            servoCurrent[servo] = servoMin[servo]; 
            applyServoPhysical(servo, servoMin[servo]); 
        } else {
            servoCurrent[servo] = safeStart;
            applyServoPhysical(servo, safeStart); 
        }
        let cmd = "INIT:" + getServoStr(servo) + ",SERVO," + safeStart + "," + pos1 + "," + pos2;
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
        if (mode == MLPinMode.OUT || mode == MLPinMode.PUSH) { 
            let v = Math.max(0, Math.min(1023, val));
            analogVals[stream] = v;
        } else { 
            analogVals[stream] = val; 
        }
        let mStr = (mode == MLPinMode.IN) ? "IN" : "OUT";
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
        let v = val > 0 ? 1 : 0; 
        digitalVals[stream] = v;
        let mStr = "IN";
        if (mode == MLPinMode.OUT) mStr = "OUT";
        if (mode == MLPinMode.PUSH) mStr = "PUSH"; 
        let cmd = "INIT:" + getDigitalStr(stream) + "," + mStr + "," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize a Text Data Stream
     */
    //% block="📝 Init Text Stream $stream | Mode $mode | Initial Text $val"
    //% group="Setup (On Start)"
    //% weight=86
    export function initText(stream: MLTextStream, mode: MLPinModeText, val: string): void {
        textVals[stream] = val;
        let mStr = (mode == MLPinModeText.IN) ? "IN" : "OUT";
        let cmd = "INIT:" + getTextStr(stream) + "," + mStr + "," + val;
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    /**
     * Initialize an Audio Alert Card
     */
    //% block="🔊 Init Audio Card $audio"
    //% group="Setup (On Start)"
    //% weight=85
    export function initAudio(audio: MLAudioID): void {
        let cmd = "INIT:" + getAudioStr(audio) + ",AUDIO,STOP";
        saveInitCmd(cmd);
        bluetooth.uartWriteString(cmd + "\n");
    }

    // ==============================================
    // SMART ROUTERS (HARDWARE ↔ CLOUD LINK)
    // ==============================================

    /**
     * Route a Digital Stream directly to/from a physical pin.
     */
    //% block="MakerLink $action digital stream $stream pin $pin"
    //% group="Hardware Link"
    //% weight=75
    export function linkDigital(action: MLAction, stream: MLDigitalStream, pin: DigitalPin): void {
        if (action === MLAction.Write) {
            // Take the Cloud value and output it to the physical Pin
            let v = digitalVals[stream];
            pins.digitalWritePin(pin, v);
        } else {
            // Read the physical Pin and send it up to the Cloud Dashboard
            let v = pins.digitalReadPin(pin);
            // Only send if the value actually changed to prevent flooding Bluetooth!
            if (digitalVals[stream] !== v) {
                digitalVals[stream] = v;
                sendDigital(stream, v);
            }
        }
    }

    /**
     * Route an Analog Stream directly to/from a physical pin.
     */
    //% block="MakerLink $action analog stream $stream pin $pin"
    //% group="Hardware Link"
    //% weight=74
    export function linkAnalog(action: MLAction, stream: MLAnalogStream, pin: AnalogPin): void {
        if (action === MLAction.Write) {
            // Take the Cloud value and output it to the physical Pin (PWM)
            let v = analogVals[stream];
            pins.analogWritePin(pin, v);
        } else {
            // Read the physical Pin and send it up to the Cloud Dashboard
            let v = pins.analogReadPin(pin);
            // Noise Filter: Only send if value changes by more than 5 to prevent Bluetooth crashes!
            if (Math.abs(analogVals[stream] - v) > 5) {
                analogVals[stream] = v;
                sendAnalog(stream, v);
            }
        }
    }

    // ==============================================
    // ACTION BLOCKS (AUTO-CONTROL)
    // ==============================================

    /**
     * Runs the motor (-255 to 255)
     */
    //% block="MakerLink run motor $motor at speed $speed"
    //% inlineInputMode=inline
    //% group="Write (Actions)"
    //% speed.min=-255 speed.max=255
    //% weight=72
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
    //% inlineInputMode=inline
    //% group="Write (Actions)"
    //% expandableArgumentMode="toggle"
    //% delay.defl=0
    //% weight=71
    export function setServo(servo: ServoID, angle: number, delay: number = 0): void {
        let val = Math.max(servoMin[servo], Math.min(servoMax[servo], angle));
        servoVals[servo] = val; 
        servoDelay[servo] = Math.max(0, delay); 
    }

    // ==============================================
    // REPORTER VARIABLES (READ)
    // ==============================================

    /**
     * Check if a new text message has arrived from the Dashboard
     */
    //% block="MakerLink has new text on $stream?"
    //% group="Read (Variables)"
    //% weight=70
    export function hasNewText(stream: MLTextStream): boolean { 
        return textVals[stream] !== ""; 
    }

    /**
     * Reads the latest text and IMMEDIATELY erases it so it doesn't repeat!
     */
    //% block="📝 MakerLink Text Stream $stream value"
    //% group="Read (Variables)"
    //% weight=69
    export function getTextValue(stream: MLTextStream): string { 
        let val = textVals[stream];
        textVals[stream] = ""; // Auto-clears the string so the micro:bit only scrolls it once!
        return val; 
    }

    /**
     * Read the latest Motor value received from the Web App
     */
    //% block="MakerLink Motor $motor value"
    //% group="Read (Variables)"
    //% weight=68
    export function getMotorValue(motor: MotorID): number { return motorVals[motor]; }

    /**
     * Read the latest Target Servo angle received from the Web App
     */
    //% block="MakerLink Servo $servo value"
    //% group="Read (Variables)"
    //% weight=67
    export function getServoValue(servo: ServoID): number { return servoVals[servo]; }

    /**
     * Read the latest Analog Stream value received from the Web App
     */
    //% block="MakerLink Analog Stream $stream value"
    //% group="Read (Variables)"
    //% weight=66
    export function getAnalogValue(stream: MLAnalogStream): number { return analogVals[stream]; }

    /**
     * Read the latest Digital Stream state received from the Web App
     */
    //% block="MakerLink Digital Stream $stream value"
    //% group="Read (Variables)"
    //% weight=65
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
     * Play a sound on the Dashboard Audio Card
     */
    //% block="📤 Update Dashboard Audio $audio | Play $sound | Mode $mode"
    //% group="Send (Update Dashboard)"
    //% weight=55
    export function playAudio(audio: MLAudioID, sound: MLAudioSound, mode: MLAudioMode): void {
        let sStr = "BEEP";
        if (sound == MLAudioSound.Siren) sStr = "SIREN";
        if (sound == MLAudioSound.Chime) sStr = "CHIME";
        let mStr = "ONCE";
        if (mode == MLAudioMode.Loop) mStr = "LOOP";
        bluetooth.uartWriteString(getAudioStr(audio) + ":PLAY:" + sStr + ":" + mStr + "\n");
    }

    /**
     * Stop a sound on the Dashboard Audio Card
     */
    //% block="📤 Update Dashboard Audio $audio | STOP"
    //% group="Send (Update Dashboard)"
    //% weight=54
    export function stopAudio(audio: MLAudioID): void {
        bluetooth.uartWriteString(getAudioStr(audio) + ":STOP\n");
    }

    /**
     * Sends a custom text log to the Web Dashboard Terminal.
     * @param msg The message to send
     */
    //% block="📤 Update Dashboard Terminal $msg"
    //% group="Send (Update Dashboard)"
    //% weight=50
    export function sendTerminalLog(msg: string): void {
        bluetooth.uartWriteString("LOG:" + msg + "\n");
    }
}
