import 'dart:io';

Future<void> main() async {
  final root = Directory('build/web').absolute;
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 7357);
  await for (final request in server) {
    var path = request.uri.path == '/'
        ? 'index.html'
        : request.uri.path.substring(1);
    final file = File(
      '${root.path}${Platform.pathSeparator}${path.replaceAll('/', Platform.pathSeparator)}',
    );
    final target = await file.exists()
        ? file
        : File('${root.path}${Platform.pathSeparator}index.html');
    final extension = target.path.split('.').last.toLowerCase();
    request.response.headers.contentType = switch (extension) {
      'html' => ContentType.html,
      'js' => ContentType('application', 'javascript'),
      'json' => ContentType.json,
      'wasm' => ContentType('application', 'wasm'),
      'png' => ContentType('image', 'png'),
      'jpg' || 'jpeg' => ContentType('image', 'jpeg'),
      'ttf' => ContentType('font', 'ttf'),
      _ => ContentType.binary,
    };
    request.response.add(await target.readAsBytes());
    await request.response.close();
  }
}
