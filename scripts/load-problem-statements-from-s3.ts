import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

// Note: We cannot import db/storage here because db.ts checks DATABASE_URL at module load time
// We'll import them dynamically after setting DATABASE_URL

// Get DATABASE_URL from AWS Secrets Manager if not set
async function getDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) {
    console.log("✅ DATABASE_URL already set");
    return process.env.DATABASE_URL;
  }

  const region = process.env.AWS_REGION || "us-west-2";
  const appName = process.env.APP_NAME || "startupvarsity-portal";
  
  console.log(`📋 Getting DATABASE_URL from AWS Secrets Manager...`);
  
  const secretsClient = new SecretsManagerClient({ 
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  
  // Try to find the secret - it might be named with the app name prefix
  const possibleSecretNames = [
    `${appName}/DATABASE_URL`,
    `${appName}-database-url`,
    `startupvarsity-portal-database-url`,
    `DATABASE_URL`,
  ];
  
  for (const secretName of possibleSecretNames) {
    try {
      console.log(`  🔍 Trying secret: ${secretName}`);
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await secretsClient.send(command);
      
      if (response.SecretString) {
        // Try parsing as JSON first
        try {
          const secret = JSON.parse(response.SecretString);
          const dbUrl = secret.DATABASE_URL || secret.database_url || secret.url || secret;
          if (dbUrl && typeof dbUrl === 'string') {
            process.env.DATABASE_URL = dbUrl;
            console.log(`✅ DATABASE_URL retrieved from secret: ${secretName}`);
            return dbUrl;
          }
        } catch {
          // If not JSON, treat as plain string
          if (response.SecretString) {
            process.env.DATABASE_URL = response.SecretString;
            console.log(`✅ DATABASE_URL retrieved from secret: ${secretName}`);
            return response.SecretString;
          }
        }
      }
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        continue; // Try next secret name
      }
      console.log(`  ⚠️  Error accessing ${secretName}: ${error.message}`);
    }
  }
  
  throw new Error(`Could not find DATABASE_URL in Secrets Manager. Tried: ${possibleSecretNames.join(", ")}`);
}

// Get S3 bucket name from environment, CloudFormation, or Secrets Manager
async function getS3BucketName(): Promise<string> {
  if (process.env.AWS_S3_BUCKET_NAME) {
    return process.env.AWS_S3_BUCKET_NAME;
  }

  const region = process.env.AWS_REGION || "us-west-2";
  const appName = process.env.APP_NAME || "startupvarsity-portal";
  
  const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

  // Try the known bucket name first
  const knownBucketName = "startupvarsity-portal-files-829408051205";
  const testS3Client = new S3Client({ region, credentials });
  try {
    await testS3Client.send(new ListObjectsV2Command({ Bucket: knownBucketName, MaxKeys: 1 }));
    console.log(`  ✅ Using known bucket: ${knownBucketName}`);
    return knownBucketName;
  } catch (s3Error: any) {
    console.log(`  ⚠️  Known bucket not accessible: ${s3Error.message}`);
  }

  // Try to get from CloudFormation stack outputs
  try {
    console.log(`  🔍 Trying to get S3 bucket from CloudFormation stack...`);
    const cfClient = new CloudFormationClient({ region, credentials });
    const stsClient = new STSClient({ region, credentials });
    
    // Get account ID
    const identityResponse = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = identityResponse.Account;
    
    // Try to find the stack
    const stackName = appName;
    try {
      const describeCommand = new DescribeStacksCommand({ StackName: stackName });
      const stackResponse = await cfClient.send(describeCommand);
      
      if (stackResponse.Stacks && stackResponse.Stacks.length > 0) {
        const stack = stackResponse.Stacks[0];
        const s3BucketOutput = stack.Outputs?.find(o => o.OutputKey === "S3BucketName");
        if (s3BucketOutput?.OutputValue) {
          console.log(`  ✅ Found S3 bucket from CloudFormation: ${s3BucketOutput.OutputValue}`);
          return s3BucketOutput.OutputValue;
        }
      }
    } catch (cfError: any) {
      // Stack might not exist, continue to other methods
      console.log(`  ⚠️  CloudFormation stack not found: ${cfError.message}`);
    }
    
    // If not in outputs, try to construct from naming pattern: ${AppName}-files-${AccountId}
    const constructedBucketName = `${appName}-files-${accountId}`;
    console.log(`  💡 Trying constructed bucket name: ${constructedBucketName}`);
    try {
      await testS3Client.send(new ListObjectsV2Command({ Bucket: constructedBucketName, MaxKeys: 1 }));
      console.log(`  ✅ Verified bucket exists: ${constructedBucketName}`);
      return constructedBucketName;
    } catch (s3Error: any) {
      if (s3Error.name === "NoSuchBucket") {
        console.log(`  ⚠️  Constructed bucket does not exist: ${constructedBucketName}`);
      }
    }
  } catch (error: any) {
    console.log(`  ⚠️  Could not get from CloudFormation: ${error.message}`);
  }

  // Try to get from Secrets Manager
  const secretsClient = new SecretsManagerClient({ region, credentials });
  
  const possibleSecretNames = [
    `${appName}/S3_BUCKET_NAME`,
    `${appName}-s3-bucket-name`,
    `startupvarsity-portal-s3-bucket-name`,
    `S3_BUCKET_NAME`,
  ];
  
  for (const secretName of possibleSecretNames) {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await secretsClient.send(command);
      
      if (response.SecretString) {
        try {
          const secret = JSON.parse(response.SecretString);
          const bucketName = secret.AWS_S3_BUCKET_NAME || secret.S3_BUCKET_NAME || secret.bucket_name || secret;
          if (bucketName && typeof bucketName === 'string') {
            console.log(`  ✅ Found S3 bucket from Secrets Manager: ${bucketName}`);
            return bucketName;
          }
        } catch {
          if (response.SecretString) {
            console.log(`  ✅ Found S3 bucket from Secrets Manager: ${response.SecretString}`);
            return response.SecretString;
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "ResourceNotFoundException") {
        console.log(`  ⚠️  Error accessing ${secretName}: ${error.message}`);
      }
    }
  }
  
  // Last resort: return the known bucket name
  console.log(`  💡 Using known bucket name: ${knownBucketName}`);
  return knownBucketName;
}

// S3 client will be created after we get the bucket name
async function loadProblemStatementsFromS3() {
  // Ensure DATABASE_URL is set before importing db
  await getDatabaseUrl();
  
  // Get S3 bucket name
  const bucketName = await getS3BucketName();
  console.log(`📦 S3 Bucket: ${bucketName}`);
  
  // Create S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-west-2",
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined, // Will use IAM role if running on EC2/ECS
  });
  
  // Now import db and storage after DATABASE_URL is set
  const { db } = await import("../server/db");
  const { storage } = await import("../server/storage");
  const { problemStatements } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  
  console.log("🔍 Searching for problem statements in S3...");
  
  try {
    // First, list ALL objects in the bucket to see what we have
    console.log("\n📂 Listing ALL objects in S3 bucket...");
    const allObjects: string[] = [];
    let continuationToken: string | undefined;
    
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });
      
      const listResponse = await s3Client.send(listCommand);
      
      if (listResponse.Contents) {
        listResponse.Contents.forEach(obj => {
          if (obj.Key) {
            allObjects.push(obj.Key);
          }
        });
      }
      
      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`  ✅ Found ${allObjects.length} total object(s) in bucket`);
    if (allObjects.length > 0) {
      console.log("  Sample paths:");
      allObjects.slice(0, 30).forEach(key => {
        console.log(`    - ${key}`);
      });
      if (allObjects.length > 30) {
        console.log(`    ... and ${allObjects.length - 30} more`);
      }
    }

    // Filter for problem statement related files - search ALL JSON files and text files
    const problemFiles = allObjects.filter(key => {
      const lowerKey = key.toLowerCase();
      // Include ALL JSON files, text files, and files with problem/statement in name
      return key.endsWith('.json') || 
             key.endsWith('.txt') ||
             key.endsWith('.md') ||
             lowerKey.includes('problem') ||
             lowerKey.includes('statement');
    });

    console.log(`\n📋 Found ${problemFiles.length} potential problem statement file(s) out of ${allObjects.length} total files`);
    
    if (problemFiles.length === 0) {
      console.log("\n⚠️  No problem statement files found in S3.");
      console.log("💡 Searched for files containing 'problem', 'statement', or with .json/.txt/.md extensions");
      console.log("\n📋 All files in bucket:");
      allObjects.forEach(key => {
        console.log(`    - ${key}`);
      });
      console.log("\n💡 If problem statements are stored elsewhere, please specify the path or upload JSON files to S3");
      return;
    }

    const allProblemStatements: any[] = [];

    // Process each file
    for (const fileKey of problemFiles) {
      try {
        console.log(`\n📄 Processing: ${fileKey}`);
        
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);
        
        if (!fileResponse.Body) {
          console.log(`  ⚠️  Empty file: ${fileKey}`);
          continue;
        }

        // Read the file content
        const chunks: Uint8Array[] = [];
        for await (const chunk of fileResponse.Body as any) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const content = buffer.toString('utf-8');
        
        // Try to parse as JSON
        let problemData: any;
        try {
          problemData = JSON.parse(content);
        } catch (parseError) {
          // If not JSON, try to extract JSON-like structures from text
          console.log(`  ⚠️  Not valid JSON, trying to extract JSON from text...`);
          
          // Look for JSON-like structures in the text
          const jsonMatches = content.match(/\{[\s\S]*\}/g);
          if (jsonMatches && jsonMatches.length > 0) {
            try {
              problemData = JSON.parse(jsonMatches[0]);
              console.log(`  ✅ Extracted JSON from text file`);
            } catch {
              console.log(`  ⚠️  Could not parse as JSON, skipping: ${fileKey}`);
              continue;
            }
          } else {
            console.log(`  ⚠️  No JSON found in file, skipping: ${fileKey}`);
            continue;
          }
        }

        // Handle both single object and array
        const problems = Array.isArray(problemData) ? problemData : [problemData];
        
        for (const problem of problems) {
          // Validate required fields
          if (!problem.title || !problem.track) {
            console.log(`  ⚠️  Skipping invalid problem statement (missing title or track)`);
            console.log(`      Problem data: ${JSON.stringify(problem).substring(0, 100)}...`);
            continue;
          }

          allProblemStatements.push({
            title: problem.title,
            track: problem.track,
            summary: problem.summary || problem.description || "",
            difficulty: problem.difficulty || "Medium",
            tags: problem.tags || [],
          });
        }

        console.log(`  ✅ Loaded ${problems.length} problem statement(s) from ${fileKey}`);
      } catch (error: any) {
        console.log(`  ❌ Error reading ${fileKey}: ${error.message}`);
      }
    }

    if (allProblemStatements.length === 0) {
      console.log("\n⚠️  No valid problem statements found to import.");
      return;
    }

    console.log(`\n📋 Found ${allProblemStatements.length} problem statement(s) to import`);
    console.log("\n🔄 Importing into database...");

    let imported = 0;
    let skipped = 0;

    for (const problem of allProblemStatements) {
      try {
        // Check if problem already exists (by title)
        const existing = await db.select()
          .from(problemStatements)
          .where(eq(problemStatements.title, problem.title))
          .limit(1);

        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping existing: "${problem.title}"`);
          skipped++;
          continue;
        }

        // problem_statements.track is plain text now (the selectable list lives
        // in the `tracks` catalog), so the old pgEnum no longer rejects an
        // unknown track here. Check it explicitly rather than importing junk.
        const knownTrack = await storage.getTrackByValue(problem.track);
        if (!knownTrack) {
          console.log(
            `  ⏭️  Skipping "${problem.title}": unknown track "${problem.track}". ` +
              `Add it via the admin track picker first.`
          );
          skipped++;
          continue;
        }

        // Insert new problem statement
        await storage.createProblemStatement({ ...problem, track: knownTrack.value });
        console.log(`  ✅ Imported: "${problem.title}" (${knownTrack.value})`);
        imported++;
      } catch (error: any) {
        console.log(`  ❌ Error importing "${problem.title}": ${error.message}`);
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${allProblemStatements.length}`);
  } catch (error: any) {
    console.error("❌ Error loading problem statements from S3:", error);
    throw error;
  }
}

// Run if called directly
loadProblemStatementsFromS3()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Failed:", error);
    process.exit(1);
  });

export { loadProblemStatementsFromS3 };
