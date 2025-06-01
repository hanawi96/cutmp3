import QRCode from "qrcode";

export const generateQRCode = async (downloadUrl, state) => {
  try {
    console.log(
      "[generateQRCode] Generating QR code for URL:",
      downloadUrl
    );

    // Tạo QR code với options tùy chỉnh
    const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });

    console.log("[generateQRCode] QR code generated successfully");
    state.setQrCodeDataUrl(qrDataUrl);
    state.setShowQrCode(true);

    return qrDataUrl;
  } catch (error) {
    console.error("[generateQRCode] Error generating QR code:", error);
    
    // Fallback: Use QR server API
    console.log("[generateQRCode] Fallback to QR server API");
    const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(downloadUrl)}`;
    state.setQrCodeDataUrl(fallbackQrUrl);
    state.setShowQrCode(true);
    
    return fallbackQrUrl;
  }
};

export const copyShareLink = async (e, state) => {
  // Ngăn event bubbling
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  console.log(
    "[copyShareLink] Function called, state.shareLink:",
    state.shareLink ? "EXISTS" : "NULL"
  );
  console.log("[copyShareLink] state.isCopied:", state.isCopied);

  if (!state.shareLink) {
    console.log("[copyShareLink] Cannot copy - no link available");
    return;
  }

  try {
    console.log("[copyShareLink] Attempting to copy link:", state.shareLink);
    await navigator.clipboard.writeText(state.shareLink);

    console.log(
      "[copyShareLink] Link copied successfully, setting state.isCopied to true"
    );
    state.setIsCopied(true);

    // Reset về "Copy" sau 2 giây
    setTimeout(() => {
      console.log(
        "[copyShareLink] Resetting state.isCopied to false after 2 seconds"
      );
      state.setIsCopied(false);
    }, 2000);

    console.log("[copyShareLink] Copy operation completed successfully");
  } catch (error) {
    console.error("[copyShareLink] Error copying link:", state.error);
    alert("❌ Failed to copy link. Please copy manually.");
  }
}; 