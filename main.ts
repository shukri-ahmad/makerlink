//% color="#22c55e" weight=100 icon="\uf1e6" block="MakerLink"
//% groups='["Setup (On Start)", "Write (Actions)", "Read (Variables)", "Send (Update Dashboard)"]'
namespace makerlink {
    
    // ==============================================
    // DROPDOWN MENUS (ENUMS)
    // ==============================================
    export enum MotorID { M1, M2, M3, M4 }
    export enum ServoID { S1, S2, S3, S4, S5, S6, S7, S8 }
    export enum MLPinMode { IN, OUT }
    export enum MLAnalogPin { P0, P1, P2 }
    export enum MLDigitalPin { P9, P12, P13, P14, P15, P16 }

    // ==============================================
    // INTERNAL STATE (THE "BRAIN")
    // ==============================================
    let motorVals = [0, 0, 0, 0];
    let servoVals = [90, 90, 90, 90, 90, 90, 90, 90];
    let analogVals = [0, 0, 0];
    let digitalVals = [0, 0, 0, 0, 0, 0];
    let isInitialized = false;

    // ==============================================
    // UTILITIES
    // ==============================================
    function getMotorStr(id: MotorID): string {
        if(id == MotorID.M1) return "M1"; if(id == MotorID.M2) return "M2";
        if(id == MotorID.M3) return "M3"; return "M4";
    }
    function getServoStr(id: ServoID): string {
        return "S" + (id + 1); 
    }
    function getAnalogStr(id: MLAnalogPin): string {
        if(id == MLAnalogPin.P0) return "P0"; if(id == MLAnalogPin.P1) return "P1"; return "P2";
    }
    function getDigitalStr(id: MLDigitalPin): string {
        if(id == MLDigitalPin.P9) return "P9"; if(id == MLDigitalPin.P12) return "P12";
        if(id == MLDigitalPin.P13) return "P13"; if(id == MLDigitalPin.P14) return "P14";
        if(id == MLDigitalPin.P15) return "P15"; return "P16";
    }

    function parseCommand(cmd: string) {
        let parts = cmd.split(":");
        if (parts.length != 2) return;
        let id = parts[0];
        let val = parseInt(parts[1]);

        if (id.charAt(0) == 'M') {
            let mIndex = parseInt(id.charAt(1)) - 1;
            if (mIndex >= 0 && mIndex <= 3) motorVals[mIndex] = val;
        } else if (id.charAt(0) == 'S') {
            let sIndex = parseInt(id.charAt(1)) - 1;
            if (sIndex >= 0 && sIndex <= 7) servoVals[sIndex] = val;
        } else if (id.charAt(0) == 'P') {
            if (id == "P0") analogVals[0] = val;
            else if (id == "P1") analogVals[1] = val;
            else if (id == "P2") analogVals[2] = val;
            else if (id == "P9") digitalVals[0] = val;
            else if (id == "P12") digitalVals[1] = val;
            else if (id == "P13") digitalVals[2] = val;
            else if (id == "P14") digitalVals[3] = val;
            else if (id == "P15") digitalVals[4] = val;
            else if (id == "P16") digitalVals[5] = val;
        }
    }

    // ==============================================
    // SETUP BLOCKS (on start)
    // ==============================================

    /**
     * Initializes MakerLink Bluetooth and the hidden background listener.
     */
    //% block="📡 MakerLink: Initialize"
    //% group="Setup (On Start)"
    //% weight=100
    export function initialize(): void {
        if (isInitialized) return;
        bluetooth.startUartService();
        
        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            let cmd = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine));
            parseCommand(cmd.trim());
        });
        isInitialized = true;
    }

    /**
     * Initialize a DC Motor Card
     */
    //% block="⚙️ Init Motor Card $motor \vert{}\vert{} Start$startVal CW Speed $cw CCW Speed$ccw"
    //% group="Setup (On Start)"
    //% expandableArgumentMode="toggle"
    //% startVal.defl=0 cw.defl=255 ccw.defl=-255
    //% weight=90
    export function initMotor(motor: MotorID, startVal: number = 0, cw: number = 255, ccw: number = -255): void {
        motorVals[motor] = startVal;
        bluetooth.uartWriteString("INIT:" + getMotorStr(motor) + ",MOTOR," + startVal + "," + cw + "," + ccw + "\n");
    }

    /**
     * Initialize a Servo Card
     */
    //% block="🦾 Init Servo Card $servo \vert{}\vert{} Start Angle$start Pos 1 $pos1 Pos 2$pos2"
    //% group="Setup (On Start)"
    //% expandableArgumentMode="toggle"
    //% start.defl=90 pos1.defl=0 pos2.defl=180
    //% weight=89
    export function initServo(servo: ServoID, start: number = 90, pos1: number = 0, pos2: number = 180): void {
        servoVals[servo] = start;
        bluetooth.uartWriteString("INIT:" + getServoStr(servo) + ",SERVO," + start + "," + pos1 + "," + pos2 + "\n");
    }

    /**
     * Initialize an Analog Pin Card
     */
    //% block="🔌 Init Analog Card $pin | Mode $mode \vert{} Initial Val$val"
    //% group="Setup (On Start)"
    //% weight=88
    export function initAnalog(pin: MLAnalogPin, mode: MLPinMode, val: number): void {
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        analogVals[pin] = val;
        bluetooth.uartWriteString("INIT:" + getAnalogStr(pin) + "," + mStr + "," + val + "\n");
    }

    /**
     * Initialize a Digital Pin Card
     */
    //% block="🔌 Init Digital Card $pin | Mode $mode \vert{} Initial Val$val"
    //% group="Setup (On Start)"
    //% weight=87
    export function initDigital(pin: MLDigitalPin, mode: MLPinMode, val: number): void {
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        bluetooth.uartWriteString("INIT:" + getDigitalStr(pin) + "," + mStr + "," + val + "\n");
    }

    // ==============================================
    // ACTION BLOCKS (AUTO-CONTROL ONLY)
    // ==============================================

    /**
     * Runs the motor (-255 to 255). Use "Update Dashboard" to sync to Web App.
     */
    //% block="MakerLink run motor $motor at speed$speed"
    //% group="Write (Actions)"
    //% speed.min=-255 speed.max=255
    //% weight=80
    export function runMotor(motor: MotorID, speed: number): void {
        let val = Math.max(-255, Math.min(255, speed));
        motorVals[motor] = val; // Keep internal state updated

        let mbMotor = MotionBitMotorChannel.M1;
        if (motor == MotorID.M2) mbMotor = MotionBitMotorChannel.M2;
        if (motor == MotorID.M3) mbMotor = MotionBitMotorChannel.M3;
        if (motor == MotorID.M4) mbMotor = MotionBitMotorChannel.M4;
                                              
        if (val > 0) {
            motionbit.runMotor(mbMotor, MotionBitMotorDirection.Forward, val);
        } else if (val < 0) {
            motionbit.runMotor(mbMotor, MotionBitMotorDirection.Backward, Math.abs(val));
        } else {
            motionbit.runMotor(mbMotor, MotionBitMotorDirection.Forward, 0);
        }
    }

    /**
     * Sets the servo angle (0 to 180). Use "Update Dashboard" to sync to Web App.
     */
    //% block="MakerLink set servo $servo to$angle degrees"
    //% group="
