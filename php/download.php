<?php
// download.php - production-ready force-download handler

// Map keys to files (relative to this script)
$files = [
  'research1' => __DIR__ . '/docs/AI_Enhanced_Predictive_Safety_Framework.pdf',
  'research2' => __DIR__ . '/docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf',
  // optional: map cv to local copy if you want; currently CV uses direct GitHub URL
];

// Get requested file key
$fileKey = $_GET['file'] ?? '';
if (!isset($files[$fileKey])) {
  http_response_code(404);
  echo "File not found";
  exit;
}

$filePath = $files[$fileKey];

// ensure file exists and is a file
if (!is_file($filePath) || !file_exists($filePath)) {
  http_response_code(404);
  echo "File missing";
  exit;
}

$fileName = basename($filePath);

// Clear output buffers
while (ob_get_level()) ob_end_clean();

// Send headers to force download
header('Content-Description: File Transfer');
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// Read file and output
readfile($filePath);
exit;
?>
