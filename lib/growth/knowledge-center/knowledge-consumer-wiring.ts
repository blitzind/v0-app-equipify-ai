/** Phase GS-3C — Consumer context bucketing (client-safe). */

export {
  bucketPlatformKnowledgeCaseStudies as bucketCaseStudies,
  bucketPlatformKnowledgeCompetitors as bucketCompetitors,
  bucketPlatformKnowledgeFaqs as bucketFaqs,
  bucketPlatformKnowledgeObjections as bucketObjections,
  bucketPlatformKnowledgePlaybooks as bucketPlaybooks,
  bucketPlatformKnowledgePricingNotes as bucketPricingNotes,
  buildPlatformKnowledgeConsumerSpecificContextMetadata as buildConsumerSpecificContextMetadata,
  buildPlatformKnowledgeContextCounts as buildContextCounts,
  bucketPlatformKnowledgeConsumerDocuments as consumerBucketDocuments,
} from "@fuzor/knowledge"
