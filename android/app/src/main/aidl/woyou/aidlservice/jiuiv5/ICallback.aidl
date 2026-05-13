package woyou.aidlservice.jiuiv5;

/**
 * Callback for print service execution results
 */
interface ICallback {

    /**
     * Return interface execution result
     * Note: this callback only indicates whether the interface executed successfully,
     * not the printer's work result. For printer results, use transaction mode.
     * @param isSuccess: true=success, false=failure
     */
    oneway void onRunResult(boolean isSuccess);

    /**
     * Return interface execution result (string data)
     * @param result: result, e.g. printed length since power on (unit: mm)
     */
    oneway void onReturnString(String result);

    /**
     * Return specific reason when interface execution fails with exception
     * @param code: exception code
     * @param msg: exception description
     */
    oneway void onRaiseException(int code, String msg);

    /**
     * Return printer result
     * @param code: result code, 0=success, 1=failure
     * @param msg: description
     */
    oneway void onPrintResult(int code, String msg);
}
