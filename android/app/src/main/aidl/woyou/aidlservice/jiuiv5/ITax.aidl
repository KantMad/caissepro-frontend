package woyou.aidlservice.jiuiv5;

/**
 * Callback for tax control command results
 */
interface ITax {

    oneway void onDataResult(in byte[] data);
}
