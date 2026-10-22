//% color="#22c55e" weight=100 icon="\uf1e6" block="MakerLink"
namespace makerlink {
    
    // --- DROPDOWN MENUS (ENUMS) ---
    export enum MotorID { M1, M2, M3, M4 }
    export enum ServoID { S1, S2, S3, S4, S5, S6, S7, S8 }
    export enum MLPinMode { IN, OUT }
    export enum MLAnalogPin { P0, P1, P2 }
    export enum MLDigitalPin { P9, P12, P13, P14, P15, P16 }

    // --- INTERNAL STATE (THE "BRAIN") ---
    let motorVals = [0, 0, 0, 0];
    let servoVals = [90, 90, 90, 90, 90, 90, 90, 90];
    let analogVals = [0, 0, 0];
    let digitalVals = [0, 0, 0, 0, 0, 0];
    let isInitialized = false;

    // --- UTILITIES ---
    function getMotorStr(id: MotorID): string {
        if(id == MotorID.M1) return "M1"; if(id == MotorID.M2) return "M2";
        if(id == MotorID.M3) return "M3"; return "M4";
    }
    function getServoStr(id: ServoID): string {
        return "S" + (id + 1); // Converts Enum 0 to "S1", etc.
    }
    function getAnalogStr(id: MLAnalogPin): string {
        if(id == MLAnalogPin.P0) return "P0"; if(id == MLAnalogPin.P1) return "P1"; return "P2";
    }
    function getDigitalStr(id: MLDigitalPin): string {
        if(id == MLDigitalPin.P9) return "P9"; if(id == MLDigitalPin.P12) return "P12";
        if(id == MLDigitalPin.P13) return "P13"; if(id == MLDigitalPin.P14) return "P14";
        if(id == MLDigitalPin.P15) return "P15"; return "P16";
    }

    /**
     * Initializes MakerLink Bluetooth and the hidden background listener.
     */
    //% block="📡 MakerLink: Initialize"
    //% weight=100
    export function initialize(): void {
        if (isInitialized) return;
        bluetooth.startUartService();
        
        // The hidden event listener for instant responsiveness
        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            let cmd = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine));
            parseCommand(cmd.trim());
        });
        isInitialized = true;
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
    // CARD INITIALIZATION BLOCKS (on start)
    // ==============================================

    /**
     * Initialize an Analog Pin Card
     */
    //% block="🔌 Init Analog Card $pin | Mode $mode | Initial Val $val"
    //% weight=90
    export function initAnalog(pin: MLAnalogPin, mode: MLPinMode, val: number): void {
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        analogVals[pin] = val;
        bluetooth.uartWriteString("INIT:" + getAnalogStr(pin) + "," + mStr + "," + val + "\n");
    }

    /**
     * Initialize a Digital Pin Card
     */
    //% block="🔌 Init Digital Card $pin | Mode $mode | Initial Val $val"
    //% weight=89
    export function initDigital(pin: MLDigitalPin, mode: MLPinMode, val: number): void {
        let mStr = mode == MLPinMode.IN ? "IN" : "OUT";
        bluetooth.uartWriteString("INIT:" + getDigitalStr(pin) + "," + mStr + "," + val + "\n");
    }

    /**
     * Initialize a DC Motor Card
     */
    //% block="⚙️ Init Motor Card $motor | Start $startVal | CW Speed $cw | CCW Speed $ccw"
    //% weight=88
    //% cw.defl=255 ccw.defl=-255
    export function initMotor(motor: MotorID, startVal: number, cw: number, ccw: number): void {
        motorVals[motor] = startVal;
        bluetooth.uartWriteString("INIT:" + getMotorStr(motor) + ",MOTOR," + startVal + "," + cw + "," + ccw + "\n");
    }

    /**
     * Initialize a Servo Card
     */
    //% block="🦾 Init Servo Card $servo | Start Angle $start | Pos 1 $pos1 | Pos 2 $pos2"
    //% weight=87
    //% start.defl=90 pos1.defl=0 pos2.defl=180
    export function initServo(servo: ServoID, start: number, pos1: number, pos2: number): void {
        servoVals[servo] = start;
        bluetooth.uartWriteString("INIT:" + getServoStr(servo) + ",SERVO," + start + "," + pos1 + "," + pos2 + "\n");
    }

 // ==============================================
    // ACTION BLOCKS (AUTO-CONTROL)
    // ==============================================

    /**
     * Automatically runs the MotionBit motor based on the Web App value (-255 to 255)
     */
    //% block="MakerLink run MotionBit Motor $motor"
    //% weight=75
    export function runMotionBitMotor(motor: MotorID): void {
        let val = motorVals[motor];
        
        // Map MakerLink MotorID to MotionBitMotorChannel
        let mbMotor = MotionBitMotorChannel.M1;
        if (motor == MotorID.M2) mbMotor = MotionBitMotorChannel.M2;
        if (motor == MotorID.M3) mbMotor = MotionBitMotorChannel.M3;
        if (motor == MotorID.M4) mbMotor = MotionBitMotorChannel.M4;
                                              
        if (val > 0) {
            motionbit.runMotor(mbMotor, MotionBitMotorDirection.Forward, val);
        } else if (val < 0) {
            motionbit.runMotor(mbMotor, MotionBitMotorDirection.Backward, Math.abs(val));
        } else {
            // FIX: Run at speed 0 to stop the motor, avoiding the stopMotor error!
            motionbit.runMotor(mbMotor, MotionBitMotorDirection.Forward, 0);
        }
    }

    // ==============================================
    // REPORTER VARIABLES (READ)
    // ==============================================

    /**
     * Read the latest Motor value received from the Web App
     */
    //% block="MakerLink Motor $motor value"
    //% weight=70
    export function getMotorValue(motor: MotorID): number {
        return motorVals[motor];
    }

    /**
     * Read the latest Servo angle received from the Web App
     */
    //% block="MakerLink Servo $servo value"
    //% weight=69
    export function getServoValue(servo: ServoID): number {
        return servoVals[servo];
    }

    /**
     * Read the latest Analog Pin value received from the Web App
     */
    //% block="MakerLink Analog $pin value"
    //% weight=68
    export function getAnalogValue(pin: MLAnalogPin): number {
        return analogVals[pin];
    }

    /**
     * Read the latest Digital Pin state received from the Web App
     */
    //% block="MakerLink Digital $pin value"
    //% weight=67
    export function getDigitalValue(pin: MLDigitalPin): number {
        if(pin == MLDigitalPin.P9) return digitalVals[0];
        if(pin == MLDigitalPin.P12) return digitalVals[1];
        if(pin == MLDigitalPin.P13) return digitalVals[2];
        if(pin == MLDigitalPin.P14) return digitalVals[3];
        if(pin == MLDigitalPin.P15) return digitalVals[4];
        return digitalVals[5];
    }

    // ==============================================
    // SEND BLOCKS (UPDATE DASHBOARD)
    // ==============================================

    /**
     * Send Analog Sensor data to update the Web App Chart
     */
    //% block="📤 Update Dashboard Analog $pin to $val"
    //% weight=50
    export function sendAnalog(pin: MLAnalogPin, val: number): void {
        bluetooth.uartWriteString(getAnalogStr(pin) + ":" + val + "\n");
    }

    /**
     * Send Digital Sensor data to update the Web App State
     */
    //% block="📤 Update Dashboard Digital $pin to $val"
    //% weight=49
    export function sendDigital(pin: MLDigitalPin, val: number): void {
        bluetooth.uartWriteString(getDigitalStr(pin) + ":" + val + "\n");
    }

    /**
     * Override the Web App Motor slider position
     */
    //% block="📤 Update Dashboard Motor $motor to $val"
    //% weight=48
    export function sendMotor(motor: MotorID, val: number): void {
        bluetooth.uartWriteString(getMotorStr(motor) + ":" + val + "\n");
    }

    /**
     * Override the Web App Servo angle text
     */
    //% block="📤 Update Dashboard Servo $servo to $val"
    //% weight=47
    export function sendServo(servo: ServoID, val: number): void {
        bluetooth.uartWriteString(getServoStr(servo) + ":" + val + "\n");
    }
}
