import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class NetworkStack extends cdk.Stack {
    public readonly vpc: ec2.Vpc;

    public readonly albSecurityGroup: ec2.SecurityGroup;

    public readonly ecsServiceSecurityGroup: ec2.SecurityGroup;

    public readonly redisSecurityGroup: ec2.SecurityGroup;

    public readonly dbSecurityGroup: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, "Vpc", {
            ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
            vpcName: "nf-vpc",
            maxAzs: 2,
            natGateways: 0,
            subnetConfiguration: [
                {
                    name: "nf-public-subnet",
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    name: "nf-private-subnet",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
            gatewayEndpoints: {
                S3: {
                    service: ec2.GatewayVpcEndpointAwsService.S3,
                    subnets: [
                        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
                    ],
                },
            },
        });

        // alb-sg
        const albSg = new ec2.SecurityGroup(this, "alb-sg", {
            vpc,
            securityGroupName: "alb-sg",
            description: "alb",
        });
        albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP, "Allow http");
        albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS, "Allow https");

        cdk.Tags.of(albSg).add("Name", "alb-sg");

        // service-sg
        const ecsServicesSg = new ec2.SecurityGroup(this, "ecs-services-sg", {
            vpc,
            securityGroupName: "ecs-services-sg",
            description: "ecs services",
        });
        ecsServicesSg.addIngressRule(albSg, ec2.Port.tcp(8080), "ecs services");

        cdk.Tags.of(ecsServicesSg).add("Name", "ecs-services-sg");

        // redis-sg
        const redisSg = new ec2.SecurityGroup(this, "redis-sg", {
            vpc,
            securityGroupName: "redis-sg",
            description: "redis",
        });
        redisSg.addIngressRule(ecsServicesSg, ec2.Port.tcp(6379), "redis");

        cdk.Tags.of(redisSg).add("Name", "redis-sg");

        // db-sg
        const dbSg = new ec2.SecurityGroup(this, "db-sg", {
            vpc,
            securityGroupName: "db-sg",
            description: "database",
        });
        dbSg.addIngressRule(ecsServicesSg, ec2.Port.tcp(27017), "database");

        cdk.Tags.of(dbSg).add("Name", "db-sg");

        this.vpc = vpc;
        this.albSecurityGroup = albSg;
        this.ecsServiceSecurityGroup = ecsServicesSg;
        this.redisSecurityGroup = redisSg;
        this.dbSecurityGroup = dbSg;
    }
}
