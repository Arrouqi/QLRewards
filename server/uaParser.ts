export interface ParsedUA {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(uaInput: string | null | undefined): ParsedUA {
  const ua = uaInput || "";
  const lc = ua.toLowerCase();

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/fbav|fban|fb_iab/i.test(ua)) browser = "Facebook";
  else if (/instagram/i.test(ua)) browser = "Instagram";
  else if (/whatsapp/i.test(ua)) browser = "WhatsApp";
  else if (/line\//i.test(ua)) browser = "LINE";
  else if (/twitter|tweetdeck/i.test(ua)) browser = "Twitter";
  else if (/snapchat/i.test(ua)) browser = "Snapchat";
  else if (/tiktok/i.test(ua)) browser = "TikTok";
  else if (/crios/i.test(ua)) browser = "Chrome";
  else if (/fxios/i.test(ua)) browser = "Firefox";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)) browser = "Safari";
  else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

  let os = "Unknown";
  if (/iphone|ipad|ipod/i.test(ua)) {
    const m = ua.match(/OS (\d+[_\.]\d+(?:[_\.]\d+)?)/i);
    os = "iOS" + (m ? " " + m[1].replace(/_/g, ".") : "");
  } else if (/android/i.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/i);
    os = "Android" + (m ? " " + m[1] : "");
  } else if (/windows nt/i.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/i);
    const map: Record<string, string> = {
      "10.0": "Windows 10/11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    os = m ? (map[m[1]] || `Windows NT ${m[1]}`) : "Windows";
  } else if (/mac os x/i.test(ua)) {
    const m = ua.match(/Mac OS X (\d+[_\.]\d+(?:[_\.]\d+)?)/i);
    os = "macOS" + (m ? " " + m[1].replace(/_/g, ".") : "");
  } else if (/cros/i.test(ua)) {
    os = "Chrome OS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  let device = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(lc) && !/mobile/i.test(lc)) {
    device = "tablet";
  } else if (/iphone|ipod|android.*mobile|mobile|opera mini|iemobile|blackberry|webos/i.test(lc)) {
    device = "mobile";
  } else if (/android/i.test(lc)) {
    device = "tablet";
  }

  return { browser, os, device };
}
