import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";

export class S3Stack extends cdk.Stack {
    public readonly cicdBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        const cicdBucket = new s3.Bucket(this, "CicdBucket", {
            versioned: true,
            bucketName: "nf-cicd",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        new s3deploy.BucketDeployment(this, "CicdDeployment", {
            sources: [s3deploy.Source.asset(path.join(__dirname, "../deploy"))],
            destinationBucket: cicdBucket,
            destinationKeyPrefix: "",
        });

        this.cicdBucket = cicdBucket;
    }
}
