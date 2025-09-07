'use client'

import NoSSRWrapper from "./NoSSRWrapper";
import Home from "./Home";
import Script from "next/script";

export default function Page() {
  return <>
    <Script id="eruda" src="https://cdn.jsdelivr.net/npm/eruda" onLoad={() => {
      // @ts-expect-error exists
      window.eruda!.init();
    }} />
    <NoSSRWrapper><Home /></NoSSRWrapper>
  </>
}
