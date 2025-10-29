<?php
// Allowed files
$files = [
    'research1' => __DIR__ . '/docs/AI_Enhanced_Predictive_Safety_Framework.pdf',
    'research2' => __DIR__ . '/docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf'
];

$fileId = $_GET['file'] ?? '';
if (!isset($files[$fileId])) {
    http_response_code(404);
    echo "❌ File not found";
    exit;
}

$filePath = $files[$fileId];

if (!is_file($filePath)) {
    http_response_code(404);
    echo "❌ File not found";
    exit;
}

$fileName = basename($filePath);

// Clear output buffer
while (ob_get_level()) ob_end_clean();

// Headers to force download
header('Content-Description: File Transfer');
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// Read file
readfile($filePath);
exit;
