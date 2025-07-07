import { S3, PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'


export class S3Service {
  private s3: any

  constructor() {
    if (!process.env.IMAGES_S3_BUCKET || !process.env.IMAGES_S3_PREFIX || !process.env.IMAGES_CLOUDFRONT_PREFIX || !process.env.AWS_REGION) {
      throw new Error('Missing required environment variables')
    }
    this.s3 = new S3({ region: process.env.AWS_REGION })
  }

  private generateScreenshotKey(buffer: Buffer, url: string): string {
    const hash = createHash('sha256')
    const dateTimeStamp = new Date().toISOString().replace(/[:\s]/g, '_')
    const slugifiedURL = url.replace(/[^a-zA-Z0-9]/g, '_')
    hash.update(buffer)
    return `${process.env.IMAGES_S3_PREFIX}${dateTimeStamp}_${slugifiedURL}_${hash.digest('hex')}.png`
  }

  async uploadScreenshot(buffer: Buffer, url: string): Promise<string> {
    try {
      const key = this.generateScreenshotKey(buffer, url)
      
      await this.s3.send(new PutObjectCommand({
        Bucket: process.env.IMAGES_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'image/png'
      }))
      
      return `${process.env.IMAGES_CLOUDFRONT_PREFIX}/${key}`
    } catch (error) {
      console.error('Failed to upload screenshot:', error)
      throw new Error('Failed to upload screenshot to S3')
    }
  }
}

export const s3Service = new S3Service()
