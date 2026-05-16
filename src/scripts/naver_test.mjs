const lat = 37.5665;
const lng = 126.9780;
const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=legalcode,admcode`;
fetch(url, {
  headers: { 
    "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID,
    "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET
  }
}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d, null, 2)));
