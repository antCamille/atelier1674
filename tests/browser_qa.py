import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  for name,w,h in [('desktop',1440,1000),('mobile',390,844),('landscape',844,390)]:
   page=await browser.new_page(viewport={'width':w,'height':h},is_mobile=name=='mobile',has_touch=name=='mobile')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://127.0.0.1:5173/');await page.wait_for_function('window.previewUI && window.previewUI().layoutRevision===9')
   await page.wait_for_timeout(1000)
   await page.locator('.section-nav [data-section="canvas"]').click()
   await page.wait_for_timeout(100)
   during=await page.evaluate('window.previewUI()');assert during['transitioning'] and not during['panelVisible'],during
   await page.wait_for_function('window.previewUI().panelVisible',timeout=10000)
   before=await page.evaluate('({ui:previewUI(),y:scrollY,top:document.querySelector("#section-content").scrollTop,panel:document.querySelector("#panel").getBoundingClientRect().toJSON(),width:document.documentElement.scrollWidth})')
   await page.evaluate('scrollBy(0,750)');await page.wait_for_timeout(200)
   after=await page.evaluate('({ui:previewUI(),y:scrollY,top:document.querySelector("#section-content").scrollTop})')
   assert before['width']<=w,(name,before)
   assert after['top']>before['top'],(name,before,after)
   assert abs(after['ui']['progress']-before['ui']['progress'])<.0001,(name,before,after)
   await page.screenshot(path=f'/tmp/atelier-{name}.png')
   await page.locator('.section-nav [data-section="cut"]').click();await page.wait_for_timeout(100);await page.locator('.section-nav [data-section="detail"]').click()
   await page.wait_for_function('previewUI().panelVisible && previewUI().chapter==="detail"')
   await page.go_back();await page.wait_for_function('previewUI().panelVisible && previewUI().chapter==="cut"')
   await page.emulate_media(reduced_motion='reduce');await page.locator('.section-nav [data-section="reveal"]').click();await page.wait_for_timeout(100)
   assert (await page.evaluate('previewUI()'))['panelVisible']
   assert not errors,errors
   print(json.dumps({'viewport':name,'panel':before['panel'],'documentScroll':after['y'],'contentScroll':after['top'],'errors':errors,'checks':'travel hidden; settle reveal; native reading; interruption; history; reduced motion'}))
   await page.close()
  await browser.close()
asyncio.run(main())
