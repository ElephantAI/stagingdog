import { z } from 'zod';
import { Stagehand, AvailableModelSchema } from '@browserbasehq/stagehand'
import { isWhitelisted } from '../utils/urlValidator.js'
import { ok as assert } from 'assert'
import { s3Service } from '../services/s3Service.js'


export const viewportSpecSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
});

export const observationsSpecSchema = z.union ([z.boolean(),z.string()])

export const observationSchema = z.object({
  description: z.string(),
  method: z.string().optional(),
  arguments: z.array(z.string()).optional(),
  selector: z.string(),
});

export const observationListSchema = z.array(observationSchema)

export const navigationParamsShape = {
  url: z.string(),
  screenshot: viewportSpecSchema
              .describe("Optional viewport size for screenshot")
              .optional(),
  observations: observationsSpecSchema
                .describe("Controls what observations to include (true, string, or undefined)")
                .optional(),
  waitForLoad: z.number().int()
               .describe("Milliseconds to wait after page load")
               .optional()
}


export const navigationResultShape = {
  currentUrl: z.string()
              .describe("Final browser URL after navigation"),
  screenshotUrl: z.string()
              .describe("URL to the uploaded screenshot if one was taken")
              .optional(),
  observations:observationListSchema
              .describe("List of observed page elements, if observations were requested")
              .optional()
}

const navigationParamsSchema = z.object(navigationParamsShape)
const navigationResultSchema = z.object(navigationResultShape)

export const performInstructionParamsShape = {
  instruction: z.string()
               .describe("Natural language instruction to execute"),
  waitFor: z.union([z.string(), z.number().int()])
           .describe("Description of event to await or milliseconds to wait after action")
           .optional(),
  screenshot: viewportSpecSchema
              .describe("Optional viewport size for screenshot")
              .optional(),
  observations: observationsSpecSchema
                .describe("Controls what observations to include (true, string, or undefined)")
                .optional(),
  regionDescription: z.string()
                     .describe("Description of the specific region   to capture")
                     .optional()
}

export const performInstructionResultShape = navigationResultShape;

const performInstructionParamsSchema = z.object(performInstructionParamsShape);
const performInstructionResultSchema = z.object(performInstructionResultShape);

export type ViewportSpec = z.infer<typeof viewportSpecSchema>
export type ObservationsSpec = z.infer<typeof observationsSpecSchema>
export type Observation = z.infer<typeof observationSchema>
export type ObservationList = z.infer<typeof observationListSchema>
export type NavigationParams = z.infer<typeof navigationParamsSchema>
export type NavigationResult = z.infer<typeof navigationResultSchema>
export type PerformInstructionParams = z.infer<typeof performInstructionParamsSchema>
export type PerformInstructionResult = z.infer<typeof performInstructionResultSchema>


export class Browser {
  stagehand: Stagehand|undefined

  constructor() { this.stagehand=undefined }

  async init() : Promise<void> {
    // <RANT>
    // I freaking hate devs who specify an interface with constrained string values and provide no way to validate at runtime if a string complies.
    // Because browserbase did that here, I have to do this ridiculous repetition of the knowlege of their type constraints.
    // </RANT>
    const stagehandEnvString = process.env.STAGEHAND_ENV || 'LOCAL';
    assert(stagehandEnvString === 'LOCAL' || stagehandEnvString === 'BROWSERBASE ', 'STAGEHAND_ENV must be LOCAL or BROWSERBASE')
    const typedStaghandEnv = stagehandEnvString as 'LOCAL' | 'BROWSERBASE'

    // At least this one was done the right way with a zod schema that can validate and cast a freeform string
    const modelNameString = process.env.MODEL_NAME || 'gpt-4o'
    const typedModelName = AvailableModelSchema.parse(modelNameString)

    console.log("Browser.init()")
    const needInit:boolean = !(this.stagehand);
    try {
      this.stagehand ||= new Stagehand({
        env: typedStaghandEnv,
        modelName: typedModelName,
        modelClientOptions: {
          apiKey: process.env.OPENAI_API_KEY
        },
        localBrowserLaunchOptions: { 
          headless:true,
          args: ['--disable-gpu'],
          devtools: false
        }
      })
      
      if (!this.stagehand) {
        throw new Error('Failed to create Stagehand instance')
      }
      
      if (needInit) {
        await this.stagehand.init()
      }
      
      if (!this.stagehand?.page) {
        throw new Error('Stagehand page not initialized')
      }
    } catch (error) {
      console.error('Stagehand initialization error:', error)
      throw error
    }
  }

  async  release():Promise<void> {
    console.log("In Browser.release")
    if (this.stagehand) {
      try { await this.stagehand.close() 
        console.log("closed stagehand")
      } catch (err) {
        const typedErr:Error = err as Error;
        // if it was already closed, that's OK, let other stuff bubble up
        if (typedErr.message.includes('TargetClosedError')) {
          console.log("stagehand was already closed?")
        } else {
          throw err
        }
      } 
      this.stagehand = undefined
    }
  }
  
  static async waitForPageToSettle(page: any): Promise<void> {
    const timestampBeforeSettle = Date.now()
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    const settleTime = Date.now() - timestampBeforeSettle
    console.log(`page settled in ${settleTime} ms`)
  }


  async doScreenshot(url:string, waitForLoad:number|undefined): Promise<string> {
      assert(this.stagehand, "this.stagehand is uninitialized in doScreenshot")
      if (waitForLoad) {
        // promise-wrap a timer for waitForLoad ms
        await Promise.all([
          new Promise<void>((resolve, _reject) => {
            setTimeout(() => resolve(), waitForLoad)
          })
        ])
      }
      console.log("about to get screenshot at ", url)
      const screenshotBuffer = await this.stagehand.page.screenshot()
      const screenshotUrl = await s3Service.uploadScreenshot(screenshotBuffer, url)
      console.log(`got screenshot at ${url} -> ${screenshotUrl}`)
      return screenshotUrl
  }

  async navigateToPage({ 
    url, 
    screenshot, 
    observations, 
    waitForLoad 
  }: NavigationParams 
    ): Promise<NavigationResult> {
    if (!this.stagehand?.page) {
      throw new Error('Stagehand not initialized')
    }

    // console.log(`attempt to navigate to "${url}"`)
    if (!isWhitelisted(url)) {
      throw new Error(`URL ${url} is not whitelisted`)
    }

    if (this.stagehand.page.isClosed()) { console.log("page was closed, re-initializing stagehand") ; await this.release(); await this.init(); } else { console.log("The page thinks it is not closed") }

    console.log("about to goto ", url)
    if (screenshot) {
      console.log(`setting viewport to ${JSON.stringify(screenshot)}`)
      await this.stagehand.page.setViewportSize(screenshot)
    }
    const timestampBeforeGoto = Date.now()
    await this.stagehand.page.goto(url)
    const gotoTime = Date.now() - timestampBeforeGoto
    console.log(`page goto took ${gotoTime} ms`)
    console.log("executed goto")
    await Browser.waitForPageToSettle(this.stagehand.page)
    console.log("now at ", url)
    console.log("page is ", JSON.stringify(this.stagehand.page, null, 2))
    
    console.log(`about to record currentUrl`)
    const result: NavigationResult = {
      currentUrl: this.stagehand.page.url()
    }

    if (screenshot) {
      console.log(`about to call doScreenshot for ${url}`)
      result.screenshotUrl = await this.doScreenshot(url, waitForLoad)
    }

    // Handle observations if requested
    if (observations) {
      console.log(`${Date.now()}: getting observations`)
      if (typeof observations === 'string' && observations.toLowerCase() !== 'true') {
        // Use the string as an instruction for what to observe
        result.observations = await this.stagehand.page.observe(observations)
      } else {
        // Default observation of all elements
        result.observations = await this.stagehand.page.observe()
      } 
      console.log(`${Date.now()}: finished getting observations: ${JSON.stringify(result.observations,null,2)}`)
    }

    return result
  }

  async performInstruction({
    instruction,
    waitFor,
    screenshot,
    observations
  }: PerformInstructionParams ): Promise<PerformInstructionResult> {
    if (!this.stagehand?.page) {
      throw new Error('Stagehand not initialized')
    }

    // Set viewport if specified
    if (screenshot) {
      await this.stagehand.page.setViewportSize(screenshot)
    }

    console.log(`${Date.now()}: about to page.act with instruction "${instruction}"`)
    // Execute the instruction
    const timestampBeforeAct = Date.now()
    await this.stagehand.page.act(instruction)
    const actTime = Date.now() - timestampBeforeAct
    console.log(`page act took ${actTime} ms`)

    // Wait for page to settle (reuse from navigateToPage)
    await Browser.waitForPageToSettle(this.stagehand.page)

    // Handle screenshot if requested
    const result: PerformInstructionResult = {
      currentUrl: this.stagehand.page.url()
    }

    if (screenshot) {
      result.screenshotUrl = await this.doScreenshot(this.stagehand.page.url(), typeof waitFor === 'number' ? waitFor : undefined)
      console.log(`${Date.now()}: done with screenshot`)
    }

    // Handle observations if requested
    if (observations) {
      console.log(`${Date.now()}: getting observations`)
      if (typeof observations === 'string' && observations.toLowerCase() !== 'true') {
        // Use the string as an instruction for what to observe
        result.observations = await this.stagehand.page.observe(observations)
      } else {
        // Default observation of all elements
        result.observations = await this.stagehand.page.observe()
      }
      console.log(`${Date.now()}: finished getting observations`)
    }

    return result
  }
}
