use gear_wasm_builder::WasmBuilder;

fn main() {
    WasmBuilder::new()
        .exclude_features(vec!["std"])
        .build();
}
