// AIDL Version: V2 (P/V series) - matches Sunmi T2s firmware 2.16 print service
// Source: Official Sunmi SDK / SunmiPrinterDemo
// CRITICAL: Method order must match the server exactly - do NOT reorder methods

package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.ITax;
import android.graphics.Bitmap;
import com.sunmi.trans.TransBean;

interface IWoyouService
{
    /**
     * Replace original firmware upgrade interface (void updateFirmware())
     * Now changed to data interface with package name, system call only
     * Supported version: 4.0.0+
     */
    boolean postPrintData(String packageName, in byte[] data, int offset, int length);

    /**
     * Printer firmware status
     * Return: 0--unknown, A5--bootloader, C3--print
     */
    int getFirmwareStatus();

    /**
     * Get print service version
     * Return: WoyouService version
     */
    String getServiceVersion();

    /**
     * Initialize printer, reset logical program but don't clear buffer data,
     * so unfinished print jobs will continue after reset
     */
    void printerInit(in ICallback callback);

    /**
     * Printer self-check, printer will print a self-check page
     */
    void printerSelfChecking(in ICallback callback);

    /**
     * Get printer board serial number
     * Return: printer board serial number
     */
    String getPrinterSerialNo();

    /**
     * Get printer firmware version
     * Return: printer firmware version
     */
    String getPrinterVersion();

    /**
     * Get printer model
     * Return: printer model
     */
    String getPrinterModal();

    /**
     * Get printed length since power on
     * Returned via callback onReturnString
     */
    void getPrintedLength(in ICallback callback);

    /**
     * Feed paper (force line break, feed n lines after finishing previous content)
     * n: number of lines to feed
     */
    void lineWrap(int n, in ICallback callback);

    /**
     * Print using raw EPSON commands
     */
    void sendRAWData(in byte[] data, in ICallback callback);

    /**
     * Set alignment mode, affects subsequent printing until init
     * alignment: 0--left, 1--center, 2--right
     */
    void setAlignment(int alignment, in ICallback callback);

    /**
     * Set print font (system call only, external calls have no effect)
     */
    void setFontName(String typeface, in ICallback callback);

    /**
     * Set font size, affects subsequent printing until init
     * Note: font size is beyond standard international commands,
     * adjusting font size affects character width, characters per line changes,
     * so monospaced typesetting may break
     * fontsize: font size
     */
    void setFontSize(float fontsize, in ICallback callback);

    /**
     * Print text, auto line wrap when text fills a line, won't print partial lines unless forced
     * text: text string to print
     */
    void printText(String text, in ICallback callback);

    /**
     * Print text with specified font, font setting only effective for this call
     * text: text to print
     * typeface: font name (system call only, external calls have no effect)
     * fontsize: font size
     */
    void printTextWithFont(String text, String typeface, float fontsize, in ICallback callback);

    /**
     * Print one row of a table, can specify column widths and alignment
     * colsTextArr: text string array for each column
     * colsWidthArr: width array for each column (in English chars, each Chinese char = 2, each width > 0)
     * colsAlign: alignment for each column (0=left, 1=center, 2=right)
     * Note: all three arrays must have same length; text wraps if colsText[i] wider than colsWidth[i]
     */
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);

    /**
     * Print bitmap image
     * bitmap: max width 384 pixels, exceeding won't display fully; image size length*width < 8M
     */
    void printBitmap(in Bitmap bitmap, in ICallback callback);

    /**
     * Print 1D barcode
     * data: barcode data
     * symbology: barcode type
     *    0 -- UPC-A
     *    1 -- UPC-E
     *    2 -- JAN13(EAN13)
     *    3 -- JAN8(EAN8)
     *    4 -- CODE39
     *    5 -- ITF
     *    6 -- CODABAR
     *    7 -- CODE93
     *    8 -- CODE128
     * height: barcode height, 1-255, default 162
     * width: barcode width, 2-6, default 2
     * textposition: text position 0--no text, 1--above, 2--below, 3--both
     */
    void printBarCode(String data, int symbology, int height, int width, int textposition, in ICallback callback);

    /**
     * Print 2D QR code
     * data: QR code data
     * modulesize: QR block size (unit: dot, 1-16)
     * errorlevel: QR error correction level (0-3)
     *    0 -- Level L (7%)
     *    1 -- Level M (15%)
     *    2 -- Level Q (25%)
     *    3 -- Level H (30%)
     */
    void printQRCode(String data, int modulesize, int errorlevel, in ICallback callback);

    /**
     * Print text with proportional (vector) font width, auto line wrap
     * text: text string to print
     */
    void printOriginalText(String text, in ICallback callback);

    /**
     * Lib package print interface
     * transbean: print task list
     */
    void commitPrint(in TransBean[] transbean, in ICallback callback);

    /**
     * Print buffer contents
     */
    void commitPrinterBuffer();

    /**
     * Enter transaction/buffer mode, all print calls will be cached;
     * Call commitPrinterBuffer(), exitPrinterBuffer(true),
     * commitPrinterBufferWithCallback(), or exitPrinterBufferWithCallback(true) to print
     * clean: if previously in transaction mode, whether to clear cached buffer content
     */
    void enterPrinterBuffer(in boolean clean);

    /**
     * Exit buffer mode
     * commit: whether to print buffer contents
     */
    void exitPrinterBuffer(in boolean commit);

    /**
     * Send tax control command
     * data: tax control command
     */
    void tax(in byte[] data, in ITax callback);

    /**
     * Get printer head model
     * Returned via callback onReturnString
     */
    void getPrinterFactory(in ICallback callback);

    /**
     * Clear printer buffer data (system call only, external calls have no effect)
     */
    void clearBuffer();

    /**
     * Print buffer contents with callback
     */
    void commitPrinterBufferWithCallback(in ICallback callback);

    /**
     * Exit buffer print mode with callback
     * commit: whether to commit buffer contents
     */
    void exitPrinterBufferWithCallback(in boolean commit, in ICallback callback);

    /**
     * Print one row of a table with proportional column widths
     * colsTextArr: text string array for each column
     * colsWidthArr: width weight array (proportional widths)
     * colsAlign: alignment for each column (0=left, 1=center, 2=right)
     * Note: all three arrays must have same length
     */
    void printColumnsString(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);

    /**
     * Get printer's latest status
     * Return: 1=normal, 2=preparing, 3=comm error, 4=out of paper, 5=overheated, 505=no printer, 507=update failed
     */
    int updatePrinterState();

    /**
     * Custom bitmap printing
     * bitmap: bitmap object (max width 384px, images over 1M cannot print)
     * type: 0=same as printBitmap, 1=black/white threshold 200, 2=grayscale
     */
    void printBitmapCustom(in Bitmap bitmap, in int type, in ICallback callback);

    /**
     * Get forced font doubling state
     * Return: 0=disabled, 1=double width, 2=double height, 3=double width+height
     */
    int getForcedDouble();

    /**
     * Is forced anti-white style enabled
     * Return: true=enabled, false=disabled
     */
    boolean isForcedAntiWhite();

    /**
     * Is forced bold style enabled
     * Return: true=enabled, false=disabled
     */
    boolean isForcedBold();

    /**
     * Is forced underline style enabled
     * Return: true=enabled, false=disabled
     */
    boolean isForcedUnderline();

    /**
     * Get forced row height state
     * Return: -1=disabled, 0-255=forced row height in pixels
     */
    int getForcedRowHeight();

    /**
     * Get current font
     * Return: 0=Sunmi Font 1.0, 1=Sunmi Font 2.0
     */
    int getFontName();
}
