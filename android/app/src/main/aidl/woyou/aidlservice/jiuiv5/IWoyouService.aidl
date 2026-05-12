package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;

interface IWoyouService {
    void printerInit(ICallback callback);
    void printerSelfChecking(ICallback callback);

    String getPrinterSerialNo();
    String getPrinterVersion();
    String getServiceVersion();
    int getPrinterModal();
    int getPrinterPaper();

    int updatePrinterState();

    void sendRAWData(in byte[] data, ICallback callback);

    void setAlignment(int alignment, ICallback callback);
    void setFontSize(float fontsize, ICallback callback);

    void printText(String text, ICallback callback);
    void printTextWithFont(String text, String typeface, float fontsize, ICallback callback);
    void printOriginalText(String text, ICallback callback);

    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, ICallback callback);
    void printColumnsString(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, ICallback callback);

    void printBarCode(String data, int symbology, int height, int width, int textposition, ICallback callback);
    void printQRCode(String data, int modulesize, int errorlevel, ICallback callback);

    void printBitmap(in android.graphics.Bitmap bitmap, ICallback callback);

    void lineWrap(int n, ICallback callback);

    void cutPaper(ICallback callback);

    void openDrawer(ICallback callback);

    void setHeader(String content, ICallback callback);
    void setFooter(String content, ICallback callback);

    void commitPrinterBuffer();
    void enterPrinterBuffer(boolean isClean);
    void exitPrinterBuffer(boolean isCommit);

    void commitPrint(in android.graphics.Bitmap[] bitmaps, ICallback callback);

    void feedPaper(int mm, ICallback callback);

    void printBitmapCustom(in android.graphics.Bitmap bitmap, int type, ICallback callback);
}
