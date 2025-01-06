import * as cdk from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import { Size } from "aws-cdk-lib";
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface EcsStackProps extends cdk.StackProps {
    ecrRepository: ecr.Repository;
    vpc: ec2.Vpc,
    ecsServiceSecurityGroup: ec2.SecurityGroup,
    blueTargetGroup: elbv2.ApplicationTargetGroup;
    greenTargetGroup: elbv2.ApplicationTargetGroup;
    albListener: elbv2.ApplicationListener;
}

export class EcsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);
        const { ecrRepository, vpc, ecsServiceSecurityGroup, blueTargetGroup, greenTargetGroup, albListener } = props;

        // ecs task definition
        const ecsTaskExecutionRole = this.createEcsTaskExecutionRole();
        const ecsTaskRole = this.createEcsTaskRole();
        const taskDefinition = this.createTaskDef(ecsTaskRole, ecsTaskExecutionRole, ecrRepository)


        // cluster
        const cluster = new ecs.Cluster(this, "Cluster", {
            vpc,
            clusterName: "nf-cluster"
        });

        // services
        const service = new ecs.FargateService(this, 'Service', {
            serviceName: "superman-service",
            cluster,
            taskDefinition,
            desiredCount: 1,
            assignPublicIp: true,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC
            },
            securityGroups: [ecsServiceSecurityGroup],
            deploymentController: {
                type: ecs.DeploymentControllerType.CODE_DEPLOY
            },
        });
        service.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)
        service.attachToApplicationTargetGroup(blueTargetGroup)

        // codedeploy 
        const codedeployApp = new codedeploy.EcsApplication(this, 'EcsCodeDeployApp', {
            applicationName: "superman"
        });

        const codeDeployRole = this.createCodeDeployRole()

        new codedeploy.EcsDeploymentGroup(this, 'EcsDeploymentGroup', {
            application: codedeployApp,
            deploymentGroupName: "superman-group",
            service: service,
            deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
            blueGreenDeploymentConfig: {
                blueTargetGroup: blueTargetGroup,
                greenTargetGroup: greenTargetGroup,
                listener: albListener
            },
            autoRollback: {
                failedDeployment: true,
            },
            role: codeDeployRole
        });

    }

    private createTaskDef(taskRole: iam.Role, executionRole: iam.Role, repository: ecr.Repository): ecs.FargateTaskDefinition {
        const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
            taskRole: taskRole,
            executionRole: executionRole,
            cpu: 512,
            memoryLimitMiB: 1024,
            family: "superman-td",
        });

        taskDef.addContainer("SupermanContainer", {
            image: ecs.ContainerImage.fromEcrRepository(repository, "latest"),
            containerName: "superman",
            portMappings: [
                {
                    containerPort: 8080,
                    name: "superman-port"
                }
            ],
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                mode: ecs.AwsLogDriverMode.NON_BLOCKING,
                maxBufferSize: Size.mebibytes(50),
                logGroup: new logs.LogGroup(this, 'SupermanLogGroup', {
                    retention: logs.RetentionDays.ONE_WEEK,
                    logGroupName: "/ecs/superman-td",
                    removalPolicy: cdk.RemovalPolicy.DESTROY
                }),

            })
            // environment
        })

        return taskDef;
    }

    private createCodeDeployRole(): iam.Role {
        return new iam.Role(this, 'AWSCodeDeployRoleForECS', {
            assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
            ],
        });
    }

    private createEcsTaskExecutionRole(): iam.Role {
        const ecsTaskExecutionRole = new iam.Role(this, "EcsTaskExecutionRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            roleName: "ecsTaskExecutionRole",
            description: "Role for ECS tasks to retrieve secrets from Secrets Manager",
        });

        ecsTaskExecutionRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["secretsmanager:GetSecretValue"],
                resources: ["*"],
            })
        );

        return ecsTaskExecutionRole;
    }

    private createEcsTaskRole(): iam.Role {
        const ecsTaskRole = new iam.Role(this, "EcsTaskRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            roleName: "ecsTaskRole",
            description: "Role for ECS tasks with access to S3 and DocumentDB",
        });

        ecsTaskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess")
        );

        ecsTaskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDocDBFullAccess")
        );

        return ecsTaskRole;
    }

}
