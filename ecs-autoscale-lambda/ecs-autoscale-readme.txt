This index.zip was taken from here:
https://aws.amazon.com/blogs/compute/how-to-automate-container-instance-draining-in-amazon-ecs/
and here:
https://github.com/awslabs/ecs-cid-sample

It is a lambda function plus its bundled dependencies. It is used by
the ECS clusters to automatically drain the instances in the Cluster
when the autoscaler decreases the number of instances.
