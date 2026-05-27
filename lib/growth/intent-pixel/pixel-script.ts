import { GROWTH_INTENT_PIXEL_QA_MARKER } from "@/lib/growth/intent-pixel/intent-pixel-types"
import {
  EQUIPIFY_INTENT_CONSENT_CATEGORIES_KEY,
  EQUIPIFY_INTENT_CONSENT_STORAGE_KEY,
  EQUIPIFY_INTENT_CONSENT_TIMESTAMP_KEY,
  EQUIPIFY_INTENT_CONSENT_TTL_MS,
} from "@/lib/growth/intent-pixel/intent-consent-manager-types"

export type GrowthIntentPixelScriptOptions = {
  collectUrl: string
  siteKey: string
  defaultConsent?: "unknown" | "granted" | "denied" | "not_required"
}

/**
 * Minimal first-party intent pixel (no third-party SDK).
 * Stores anonymous visitor_key / session_key in localStorage only.
 */
export function buildIntentPixelScript(options: GrowthIntentPixelScriptOptions): string {
  const collectUrl = JSON.stringify(options.collectUrl)
  const siteKey = JSON.stringify(options.siteKey)
  const defaultConsent = JSON.stringify(options.defaultConsent ?? "unknown")
  const qaMarker = JSON.stringify(GROWTH_INTENT_PIXEL_QA_MARKER)
  const consentKey = JSON.stringify(EQUIPIFY_INTENT_CONSENT_STORAGE_KEY)
  const categoriesKey = JSON.stringify(EQUIPIFY_INTENT_CONSENT_CATEGORIES_KEY)
  const consentTsKey = JSON.stringify(EQUIPIFY_INTENT_CONSENT_TIMESTAMP_KEY)
  const consentTtlMs = String(EQUIPIFY_INTENT_CONSENT_TTL_MS)

  return `(function(w,d){
  if(w.__equipifyIntentPixel) return;
  w.__equipifyIntentPixel=${qaMarker};
  var COLLECT=${collectUrl};
  var SITE_KEY=${siteKey};
  var CONSENT_KEY=${consentKey};
  var CATEGORIES_KEY=${categoriesKey};
  var CONSENT_TS_KEY=${consentTsKey};
  var CONSENT_TTL=${consentTtlMs};
  var SEGMENT_KEY="equipify_intent_personalization_segment";
  var VISITOR_KEY="equipify_intent_visitor";
  var SESSION_KEY="equipify_intent_session";
  var PAGE_START=Date.now();
  function uid(p){try{var k=d.cookie.split("; ").find(function(r){return r.indexOf(p+"=")===0});if(k)return decodeURIComponent(k.split("=").slice(1).join("="))}catch(e){}var v=p+"_"+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem(p,v)}catch(e){}return v}
  function emptyCategories(){return{analytics:false,personalization:false,marketing:false}}
  function categoriesFromStatus(status){if(status==="granted"||status==="not_required")return{analytics:true,personalization:true,marketing:true};return emptyCategories()}
  function readCategories(){try{var r=localStorage.getItem(CATEGORIES_KEY);if(r){var p=JSON.parse(r);return{analytics:!!p.analytics,personalization:!!p.personalization,marketing:!!p.marketing}}}catch(e){}return categoriesFromStatus(consentStatus())}
  function writeCategories(c){try{localStorage.setItem(CATEGORIES_KEY,JSON.stringify(c))}catch(e){}}
  function consentStatus(){try{var s=localStorage.getItem(CONSENT_KEY);var ts=localStorage.getItem(CONSENT_TS_KEY);if(s&&ts&&Date.now()-parseInt(ts,10)>CONSENT_TTL){localStorage.removeItem(CONSENT_KEY);localStorage.removeItem(CONSENT_TS_KEY);localStorage.removeItem(CATEGORIES_KEY);return ${defaultConsent}}return s||${defaultConsent}}catch(e){return ${defaultConsent}}}
  function allowsAnalytics(){return readCategories().analytics}
  function allowsPersonalization(){return readCategories().personalization}
  function allowsMarketing(){return readCategories().marketing}
  function allowsOperational(){return allowsAnalytics()||consentStatus()==="unknown"}
  function readSegment(){try{var r=localStorage.getItem(SEGMENT_KEY);if(r)return JSON.parse(r)}catch(e){}return null}
  function device(){return{user_agent:navigator.userAgent||"",language:navigator.language||"",timezone:((Intl&&Intl.DateTimeFormat&&Intl.DateTimeFormat().resolvedOptions().timeZone)||""),screen_width:screen.width||null,screen_height:screen.height||null,platform:navigator.platform||""}}
  function browser(){return{referrer:d.referrer||"",landing_url:w.location.href,page_url:w.location.href}}
  function send(evt,extra){extra=extra||{};var cats=readCategories();var body=Object.assign({site_key:SITE_KEY,event_type:evt,visitor_key:uid(VISITOR_KEY),session_key:uid(SESSION_KEY),consent_status:consentStatus(),consent_categories:cats,page_url:w.location.href,page_path:w.location.pathname+w.location.search,page_title:d.title||"",referrer:d.referrer||"",device:device(),browser:browser()},extra);if(allowsPersonalization()){var seg=readSegment();if(seg)body.personalization_segment=seg}try{fetch(COLLECT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true,credentials:"omit"})}catch(e){}}
  function duration(){return Math.max(0,Date.now()-PAGE_START)}
  w.EquipifyIntentPixel={
    version:${qaMarker},
    consent:function(status,categories){var cats=categories||categoriesFromStatus(status);try{localStorage.setItem(CONSENT_KEY,status);localStorage.setItem(CONSENT_TS_KEY,String(Date.now()));writeCategories(cats)}catch(e){}send("consent_update",{consent_status:status,consent_categories:cats})},
    trackConversion:function(type,label,meta,identity){send("conversion",{conversion_type:type||"custom",conversion_label:label||"",conversion_metadata:meta||{},submitted_identity:identity||undefined})},
    pageview:function(){if(!allowsOperational())return;PAGE_START=Date.now();send("pageview")}
  };
  if(allowsOperational())send("pageview");
  if(allowsAnalytics()){
    w.addEventListener("pagehide",function(){send("page_exit",{duration_ms:duration()})});
    d.addEventListener("visibilitychange",function(){if(d.visibilityState==="hidden")send("heartbeat",{duration_ms:duration()})});
  }else if(allowsOperational()){
    w.addEventListener("pagehide",function(){send("page_exit",{duration_ms:duration()})});
  }
})(window,document);`
}
