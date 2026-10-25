/**
 * MakerLink - Cyber-Physical Prototyping Bridge
 * Integrates with Cytron Motion:Bit via Bluetooth UART.
 */
//% color="#0ea5e9" icon="\uf0c2" block="MakerLink"
//% groups="['Setup', 'Read (From Web)', 'Send (To Web)']"
namespace MakerLink {

    export enum MotorPort { M1, M2, M3, M4 }
    export enum ServoPort { S1, S2, S3, S4, S5, S6, S7, S8 }
    export enum AnalogPort { A1, A2, A3, A4, A5, A6, A7, A8 }
    export enum DigitalPort { D1, D2, D3, D4, D5, D6, D7, D8 }
    export enum TextPort { T1, T2, T3, T4 }
    export enum StreamMode { IN, OUT }

    // Internal state caches
    let motorVals = [0, 0, 0, 0];
    let servoVals = [90, 90, 90, 90, 90, 90, 90, 90];
    let analogVals = [0, 0, 0, 0, 0, 0, 0, 0];
    let digitalVals = [0, 0, 0, 0, 0, 0, 0, 0];

    /**
     * Initializes MakerLink Bluetooth communication.
     * Place this in your 'On Start' block.
     */
    //% block="📡 MakerLink: Initialize"
    //% group="Setup"
    //% weight=100
    export function initialize(): void {
        bluetooth.startUartService();
        
        // Background Parser for Web Commands
        bluetooth.onUartDataReceived(bluetooth.NEW_LINE, function () {
            let data = bluetooth.uartReadUntil(bluetooth.NEW_LINE);
            let sepIdx = data.indexOf(":");
            if (sepIdx > 0) {
                let id = data.substr(0, sepIdx);
                let valStr = data.substr(sepIdx + 1, data.length - sepIdx - 1);
                
                if (id !== "SYNC") {
                    let cleanStr = "";
                    for(let i = 0; i < valStr.length; i++) {
                        let c = valStr.charAt(i);
                        if((c >= '0' && c <= '9') || c == '-') cleanStr += c;
                    }
                    let val = parseInt(cleanStr);
                    let prefix = id.charAt(0);
                    let num = parseInt(id.substr(1, id.length - 1)) - 1; // 0-indexed for arrays
                    
                    if (prefix == "M" && num >= 0 && num < 4) motorVals[num] = val;
                    else if (prefix == "S" && num >= 0 && num < 8) servoVals[num] = val;
                    else if (prefix == "A" && num >= 0 && num < 8) analogVals[num] = val;
                    else if (prefix == "D" && num >= 0 && num < 8) digitalVals[num] = val;
                } else {
                    bluetooth.uartWriteString("LOG:Hardware Sync Acknowledged\n");
                    basic.pause(50);
                }
            }
        });
    }

    /**
     * Creates a custom Motor Control card on the dashboard.
     */
    //% block="⚙️ Init Motor Card $port start speed: $startSpeed CCW speed: $ccwSpeed CW speed: $cwSpeed"
    //% startSpeed.min=-255 startSpeed.max=255 startSpeed.defl=0
    //% ccwSpeed.min=0 ccwSpeed.max=255 ccwSpeed.defl=255
    //% cwSpeed.min=0 cwSpeed.max=255 cwSpeed.defl=255
    //% group="Setup"
    //% weight=90
    export function initMotorCard(port: MotorPort, startSpeed: number, ccwSpeed: number, cwSpeed: number): void {
        let id = "M" + (port + 1);
        let safeStart = Math.min(255, Math.max(-255, startSpeed));
        let safeCCW = Math.min(255, Math.max(0, Math.abs(ccwSpeed)));
        let safeCW = Math.min(255, Math.max(0, Math.abs(cwSpeed)));
        
        // Split into two chunks to avoid the 20-byte Bluetooth MTU limit!
        bluetooth.uartWriteString("INIT:" + id + "," + safeStart + ",");
        basic.pause(20);
        bluetooth.uartWriteString(safeCCW + "," + safeCW + "\n");
        basic.pause(50);
    }

    /**
     * Creates a Servo Control card on the dashboard.
     */
    //% block="🦾 Init Servo Card $port start angle: $startAngle Pos 1: $pos1 Pos 2: $pos2"
    //% startAngle.min=0 startAngle.max=180 startAngle.defl=90
    //% pos1.min=0 pos1.max=180 pos1.defl=0
    //% pos2.min=0 pos2.max=180 pos2.defl=180
    //% group="Setup"
    //% weight=89
    export function initServoCard(port: ServoPort, startAngle: number, pos1: number, pos2: number): void {
        let id = "S" + (port + 1);
        let safeStart = Math.min(180, Math.max(0, Math.abs(startAngle)));
        let safePos1 = Math.min(180, Math.max(0, Math.abs(pos1)));
        let safePos2 = Math.min(180, Math.max(0, Math.abs(pos2)));
        
        // Split to avoid 20-byte limit
        bluetooth.uartWriteString("INIT:" + id + "," + safeStart + ",");
        basic.pause(20);
        bluetooth.uartWriteString(safePos1 + "," + safePos2 + "\n");
        basic.pause(50);
    }

    /**
     * Creates an Analog Stream card (Chart or Slider).
     */
    //% block="📊 Init Analog Stream $port mode: $mode start value: $startVal"
    //% startVal.min=0 startVal.max=1023 startVal.defl=0
    //% group="Setup"
    //% weight=88
    export function initAnalogStream(port: AnalogPort, mode: StreamMode, startVal: number): void {
        let id = "A" + (port + 1);
        let modeStr = mode === StreamMode.IN ? "IN" : "OUT";
        bluetooth.uartWriteString("INIT:" + id + "," + modeStr + "," + startVal + "\n");
        basic.pause(50);
    }

    /**
     * Creates a Digital Stream card (Indicator or Buttons).
     */
    //% block="🚥 Init Digital Stream $port mode: $mode start value: $startVal"
    //% startVal.min=0 startVal.max=1 startVal.defl=0
    //% group="Setup"
    //% weight=87
    export function initDigitalStream(port: DigitalPort, mode: StreamMode, startVal: number): void {
        let id = "D" + (port + 1);
        let modeStr = mode === StreamMode.IN ? "IN" : "OUT";
        bluetooth.uartWriteString("INIT:" + id + "," + modeStr + "," + startVal + "\n");
        basic.pause(50);
    }

    /**
     * Creates a Text Stream card.
     */
    //% block="📝 Init Text Stream $port start value: $startVal"
    //% group="Setup"
    //% weight=86
    export function initTextStream(port: TextPort, startVal: string): void {
        let id = "T" + (port + 1);
        
        // Text can easily exceed 20 bytes, chunk it safely
        bluetooth.uartWriteString("INIT:" + id + ",");
        basic.pause(20);
        bluetooth.uartWriteString(startVal + "\n");
        basic.pause(50);
    }

    // ==========================================
    // READ BLOCKS (Pull variables from Dashboard)
    // ==========================================

    /**
     * Read the latest Motor command from the Web App.
     */
    //% block="MakerLink Motor $port value"
    //% group="Read (From Web)"
    export function getMotorValue(port: MotorPort): number {
        return motorVals[port];
    }

    /**
     * Read the latest Servo angle from the Web App.
     */
    //% block="MakerLink Servo $port value"
    //% group="Read (From Web)"
    export function getServoValue(port: ServoPort): number {
        return servoVals[port];
    }

    /**
     * Read the latest Analog Slider value from the Web App.
     */
    //% block="MakerLink Analog $port value"
    //% group="Read (From Web)"
    export function getAnalogValue(port: AnalogPort): number {
        return analogVals[port];
    }

    /**
     * Read the latest Digital ON/OFF value from the Web App.
     */
    //% block="MakerLink Digital $port value"
    //% group="Read (From Web)"
    export function getDigitalValue(port: DigitalPort): number {
        return digitalVals[port];
    }

    // ==========================================
    // SEND BLOCKS (Push live hardware data to Dashboard)
    // ==========================================

    /**
     * Send live sensor data to update the Analog Line Chart.
     */
    //% block="📤 Update Dashboard Analog $port value: $val"
    //% group="Send (To Web)"
    export function updateDashboardAnalog(port: AnalogPort, val: number): void {
        let id = "A" + (port + 1);
        bluetooth.uartWriteString(id + ":" + val + "\n");
        basic.pause(20);
    }

    /**
     * Send immediate ON/OFF data to update the Digital Indicator.
     */
    //% block="📤 Update Dashboard Digital $port value: $val"
    //% val.min=0 val.max=1
    //% group="Send (To Web)"
    export function updateDashboardDigital(port: DigitalPort, val: number): void {
        let id = "D" + (port + 1);
        bluetooth.uartWriteString(id + ":" + val + "\n");
        basic.pause(20);
    }

    /**
     * Force the dashboard motor UI to change (e.g. limit switch triggered).
     */
    //% block="📤 Override Dashboard Motor $port value: $val"
    //% group="Send (To Web)"
    export function updateDashboardMotor(port: MotorPort, val: number): void {
        let id = "M" + (port + 1);
        bluetooth.uartWriteString(id + ":" + val + "\n");
        basic.pause(20);
    }

    /**
     * Force the dashboard servo UI to change.
     */
    //% block="📤 Override Dashboard Servo $port value: $val"
    //% group="Send (To Web)"
    export function updateDashboardServo(port: ServoPort, val: number): void {
        let id = "S" + (port + 1);
        bluetooth.uartWriteString(id + ":" + val + "\n");
        basic.pause(20);
    }

    /**
     * Update the Text Card on the Web App.
     */
    //% block="📤 Update Dashboard Text $port text: $msg"
    //% group="Send (To Web)"
    export function updateDashboardText(port: TextPort, msg: string): void {
        let id = "T" + (port + 1);
        bluetooth.uartWriteString(id + ":" + msg + "\n");
        basic.pause(20);
    }

    /**
     * Sends a custom text log to the Web Dashboard System Terminal.
     */
    //% block="📤 Update Dashboard Terminal $msg"
    //% group="Send (To Web)"
    export function sendTerminalLog(msg: string): void {
        bluetooth.uartWriteString("LOG:" + msg + "\n");
        basic.pause(20);
    }
}
