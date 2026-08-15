import Script from "next/script";
import { BAIDU_TONGJI_ID, LA_51_ID, LA_51_CK, GA_MEASUREMENT_ID } from "@/lib/analytics";

// 第三方统计脚本（图标不可见）：仅在配置了对应 ID 时注入到页面底部。
// 用 next/script 的 afterInteractive 策略，等页面交互就绪后再加载，不影响首屏。
export default function Analytics() {
  return (
    <>
      {BAIDU_TONGJI_ID ? (
        <Script id="baidu-tongji" strategy="afterInteractive">
          {`var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${BAIDU_TONGJI_ID}";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`}
        </Script>
      ) : null}

      {LA_51_ID ? (
        <>
          <Script
            id="la-51-js"
            strategy="afterInteractive"
            src="https://sdk.51.la/js-sdk-pro.min.js"
          />
          <Script id="la-51-init" strategy="afterInteractive">
            {`LA.init({id:"${LA_51_ID}",ck:"${LA_51_CK}"})`}
          </Script>
        </>
      ) : null}

      {GA_MEASUREMENT_ID ? (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script id="ga-gtag" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
