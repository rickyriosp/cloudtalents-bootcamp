import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ram from 'aws-cdk-lib/aws-ram';
import { Construct } from 'constructs';

export class CloudtalentsBootcampStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------------
    // OIDC Provider
    // ----------------------------------------------------------------------
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // ----------------------------------------------------------------------
    // VPC
    // ----------------------------------------------------------------------
    // Create a VPC with public subnets (this auto-creates an IGW)
    const vpc = new ec2.Vpc(this, 'vpc', {
      vpcName: 'vpc-network',
      ipAddresses: ec2.IpAddresses.cidr('172.16.0.0/16'),
      createInternetGateway: true,
      maxAzs: 2, // Default is 3 AZs
      // availabilityZones: ['us-east-1a', 'us-east-1b'], // Not needed if you define maxAzs
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Resources created with the VPC
    console.log(
      'VPC children:',
      vpc.node.children.map((child) => child.node.id),
    );

    // Set the Name tag for the Subnets
    vpc.publicSubnets.forEach((sn, i) => cdk.Tags.of(sn).add('Name', `PublicSubnet${i + 1}`));
    vpc.isolatedSubnets.forEach((sn, i) => cdk.Tags.of(sn).add('Name', `PrivateSubnet${i + 1}`));

    // Access the underlying CfnInternetGateway created by the VPC
    const igw = vpc.node.findChild('IGW') as ec2.CfnInternetGateway;

    // Set the Name tag for the IGW
    cdk.Tags.of(igw).add('Name', 'igw-networkvpc');

    // ----------------------------------------------------------------------
    // RAM Resource Share
    // ----------------------------------------------------------------------
    const resourceShare = new ram.CfnResourceShare(this, 'NetworkVpcShare', {
      name: 'NetworkVpcShare',
      allowExternalPrincipals: false,
      principals: [
        //Sandbox OU
        'arn:aws:organizations::746669212492:ou/o-64bj98k0kx/ou-xllq-xm6a7sjq',
      ],
      resourceArns: [
        //public subnets
        'arn:aws:ec2:us-east-1:196820083420:subnet/subnet-02f9106701ccaccdc',
        'arn:aws:ec2:us-east-1:196820083420:subnet/subnet-0a62b5636c13717f7',
        //private subnets
        'arn:aws:ec2:us-east-1:196820083420:subnet/subnet-0a1c1bb379d1fc335',
        'arn:aws:ec2:us-east-1:196820083420:subnet/subnet-019b07d9588ae5085',
      ],
    });
  }
}
