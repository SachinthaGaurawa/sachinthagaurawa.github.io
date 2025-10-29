<?php
// map file ids -> paths (use absolute server paths)
$files = [
  'research1' => __DIR__ . '/docs/AI_Enhanced_Predictive_Safety_Framework.pdf',
  'research2' => __DIR__ . '/docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf',
  'default'   => __DIR__ . '/docs/Sachintha_Gaurawa_CV.pdf'
];

$fileId = $_GET['file'] ?? 'default';
if (!array_key_exists($fileId, $files)) {
  http_response_code(404);
  echo "File not found";
  exit;
}

$filePath = $files[$fileId];
if (!is_file($filePath)) {
  http_response_code(404);
  echo "File missing";
  exit;
}

$fileName = basename($filePath);

// force download headers
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// clear output buffer
while (ob_get_level()) ob_end_clean();

// stream file in chunks
$chunkSize = 8 * 1024 * 1024;
$handle = fopen($filePath, 'rb');
if ($handle === false) {
  http_response_code(500);
  exit;
}
set_time_limit(0);
while (!feof($handle)) {
  echo fread($handle, $chunkSize);
  flush();
}
fclose($handle);
exit;
?>
