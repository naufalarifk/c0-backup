storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8201"
  tls_disable = 1
}

disable_mlock = true
ui = true
