import QRCode from "qrcode";

export const generateQRCode = async (downloadUrl, state) => {
  try {


    // Tạo QR code với options tùy chỉnh
    const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });


    state.setQrCodeDataUrl(qrDataUrl);
    state.setShowQrCode(true);

    return qrDataUrl;
  } catch (error) {
    console.error("[generateQRCode] Error generating QR code:", error);
    
    // Fallback: Use QR server API

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




  if (!state.shareLink) {

    return;
  }

  try {

    await navigator.clipboard.writeText(state.shareLink);


    state.setIsCopied(true);

    // Reset về "Copy" sau 2 giây
    setTimeout(() => {

      state.setIsCopied(false);
    }, 2000);


  } catch (error) {
    console.error("[copyShareLink] Error copying link:", state.error);
    alert("❌ Failed to copy link. Please copy manually.");
  }
}; 