import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class NetworkStack extends cdk.Stack {
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
                    subnets: [{subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}]
                }
            }
        });
    }
}
