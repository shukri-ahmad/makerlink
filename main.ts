/**
 * MakerLink - Cyber-Physical Prototyping Framework
 */
//% color="#0f172a" icon="\uf0c1" block="MakerLink"
namespace MakerLink {
    let isInitialized = false;
    let initCommands: string[] = [];
    let receivedData: { [key: string]: number } = {};

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
            
            if (cmd === "SYNC") {
                // Optimized Handshake: Only sends declared UI cards, dropping 5-second delay to 0.2s
                for (let i = 0; i < initCommands.length; i++) {
                    bluetooth.uartWriteString(initCommands[i] + "\n");
                    basic.pause(30);
                }
            } else {
                parseCommand(cmd);
            }
        });
        isInitialized = true;
    }

    function parseCommand(cmd: string) {
        let parts = cmd.split(":");
        if (parts.length === 2) {
            receivedData[parts[0]] = parseFloat(parts[1]);
        }
    }

    // --- SETUP BLOCKS ---

    //% block="📊 Init Analog Card id: $id mode: $mode start value: $startVal"
    //% group="Setup (On Start)"
    //% weight=90
    export function initAnalog(id: string, mode: string, startVal: number): void {
        initCommands.push(`INIT:${id},${mode},${startVal}`);
    }

    //% block="🚥 Init Digital Card id: $id mode: $mode start value: $startVal"
    //% group="Setup (On Start)"
    //% weight=80
    export function initDigital(id: string, mode: string, startVal: number): void {
        initCommands.push(`INIT:${id},${mode},${startVal}`);
    }

    //% block="⚙️ Init Motor Card id: $id CCW speed: $ccw CW speed: $cw"
    //% group="Setup (On Start)"
    //% weight=70
    export function initMotor(id: string, ccw: number, cw: number): void {
        initCommands.push(`INIT:${id},OUT,0,${ccw},${cw}`);
    }

    //% block="🦾 Init Servo Card id: $id Pos 1: $pos1 Pos 2: $pos2"
    //% group="Setup (On Start)"
    //% weight=60
    export function initServo(id: string, pos1: number, pos2: number): void {
        initCommands.push(`INIT:${id},OUT,90,${pos1},${pos2}`);
    }

    //% block="📝 Init Text Card id: $id value: $val"
    //% group="Setup (On Start)"
    //% weight=50
    export function initText(id: string, val: string): void {
        initCommands.push(`INIT:${id},OUT,${val}`);
    }

    // --- READ BLOCKS ---

    //% block="MakerLink Value for $id"
    //% group="Read (Variables)"
    //% weight=40
    export function getValue(id: string): number {
        return receivedData[id] || 0;
    }

    // --- SEND BLOCKS ---

    //% block="📤 Update Dashboard id: $id value: $val"
    //% group="Communication & Telemetry"
    //% weight=30
    export function sendTelemetry(id: string, val: number): void {
        bluetooth.uartWriteString(`${id}:${val}\n`);
    }

    //% block="📤 Update Dashboard Text id: $id value: $val"
    //% group="Communication & Telemetry"
    //% weight=25
    export function sendTextTelemetry(id: string, val: string): void {
        bluetooth.uartWriteString(`${id}:${val}\n`);
    }

    /**
     * Sends a custom text log to the Web Dashboard Terminal.
     * @param msg The message to send
     */
    //% block="📤 Update Dashboard Terminal $msg"
    //% group="Communication & Telemetry"
    //% weight=20
    export function sendTerminalLog(msg: string): void {
        bluetooth.uartWriteString("LOG:" + msg + "\n");
    }
}
