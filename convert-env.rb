# use this converter to take the environment definition from docker-compose
# and turn it into the format needed by cloud formation in a Task Definition
require 'yaml'
input_env = YAML.load_file('environment.yml')
output_env = []
input_env.each{|key, value|
  output_env << {"Name" => key, "Value" => value}
}
puts YAML.dump(output_env)
