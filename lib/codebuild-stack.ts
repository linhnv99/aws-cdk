import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codebuild from "aws-cdk-lib/aws-codebuild";

interface CodebuildStackProps extends cdk.StackProps {
    cicdBucket: s3.Bucket;
}

export class CodebuildStack extends cdk.Stack {
    public readonly codebuild: codebuild.Project;

    constructor(scope: Construct, id: string, props: CodebuildStackProps) {
        super(scope, id, props);

        const { cicdBucket, env: { account = "", region = "" } = {} } = props;

        // create role for codebuild
        const codebuildRole = this.createCodebuildRole()

        // create codebuild
        const codebuildProject = new codebuild.Project(
            this,
            "SupermanService",
            {
                source: codebuild.Source.s3({
                    bucket: cicdBucket,
                    path: "cicd.zip",
                }),
                role: codebuildRole,
                environment: {
                    buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
                    computeType: codebuild.ComputeType.SMALL,
                },
                environmentVariables: {
                    SERVICE_NAME: {
                        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                        value: "superman",
                    },
                    ACCOUNT: {
                        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                        value: account,
                    },
                    REGION: {
                        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                        value: region,
                    },
                },
                buildSpec: codebuild.BuildSpec.fromSourceFilename(
                    "cicd/buildspec.yml"
                ),
                projectName: "superman",
            }
        );
        this.codebuild = codebuildProject;
    }

    private createCodebuildRole(): iam.Role {
        const role = new iam.Role(this, "CodebuildRole", {
            assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
        });
        this.attachCodeBuildPolicies(role);
        return role;
    }

    private attachCodeBuildPolicies(codebuildRole: iam.Role): void {
        const ecrPolicy = new iam.Policy(this, "CodeBuildEcrPolicy", {
            policyName: "CodeBuildEcrPolicy",
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "ecr:UntagResource",
                        "ecr:GetDownloadUrlForLayer",
                        "ecr:BatchGetImage",
                        "ecr:CompleteLayerUpload",
                        "ecr:TagResource",
                        "ecr:GetAuthorizationToken",
                        "ecr:UploadLayerPart",
                        "ecr:ListImages",
                        "ecr:InitiateLayerUpload",
                        "ecr:BatchCheckLayerAvailability",
                        "ecr:GetRepositoryPolicy",
                        "ecr:PutImage",
                    ],
                    resources: ["*"],
                }),
            ],
        });

        const secretManagerPolicy = new iam.Policy(
            this,
            "CodeBuildSecretManagerPolicy",
            {
                policyName: "CodeBuildSecretManagerPolicy",
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["secretsmanager:GetSecretValue"],
                        resources: ["*"],
                    }),
                ],
            }
        );

        const cloudWatchLogsPolicy = new iam.Policy(
            this,
            "CloudWatchLogsPolicy",
            {
                policyName: "CloudWatchLogsPolicy",
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["logs:*"],
                        resources: ["*"],
                    }),
                ],
            }
        );

        codebuildRole.attachInlinePolicy(ecrPolicy);
        codebuildRole.attachInlinePolicy(secretManagerPolicy);
        codebuildRole.attachInlinePolicy(cloudWatchLogsPolicy);
    }
}
